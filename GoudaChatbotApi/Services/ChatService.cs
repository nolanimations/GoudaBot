// Services/ChatService.cs
using OpenAI.Managers;
using OpenAI.ObjectModels;
using OpenAI.ObjectModels.RequestModels;
using System.Collections.Concurrent;
using GoudaChatbotApi.Models;
using Microsoft.Extensions.Options;
using OpenAI;
using System.Runtime.CompilerServices;
using System.Text;

namespace GoudaChatbotApi.Services
{
    public static class SessionManager
    {
        public static ConcurrentDictionary<string, ChatSession> Sessions { get; } = new ConcurrentDictionary<string, ChatSession>();
    }

    public class ChatService
    {
        private readonly OpenAIService _openAiService;
        private readonly ILogger<ChatService> _logger;

        public ChatService(IOptions<OpenAiOptions> openAiOptions, ILogger<ChatService> logger)
        {
             // Basic check, consider more robust validation if needed
             if (string.IsNullOrWhiteSpace(openAiOptions?.Value?.ApiKey))
             {
                 throw new InvalidOperationException("OpenAI API Key is missing or invalid in configuration.");
             }
             _openAiService = new OpenAIService(openAiOptions.Value);
            _logger = logger;
        }

        // --- CORRECTED StreamChatCompletionChunksAsync ---
        // This method prepares the context, calls the internal streamer, and yields results.
        // It does NOT handle exceptions or history updates itself; that's the controller's job.
        public async IAsyncEnumerable<string> StreamChatCompletionChunksAsync(
            ChatRequest request, // Takes the request details (likely from cache context)
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var session = SessionManager.Sessions.GetOrAdd(request.SessionId, _ => new ChatSession());

            // Determine effective instructions (request overrides session default if provided)
            var effectiveInstructions = !string.IsNullOrWhiteSpace(request.CustomInstructions)
                ? request.CustomInstructions
                : session.CustomInstructions; // Fallback to session's stored instructions

            // --- History Management Part 1: Add User Message ---
            // Add user message to history *before* the OpenAI call.
            // This assumes the controller has validated the request and we intend to proceed.
            // If OpenAI call fails, this user message remains.
            session.History.Add(ChatMessage.FromUser(request.Message));

            // --- Prepare OpenAI Request ---
            // Create a snapshot of the history *including* the new user message.
            var messages = new List<ChatMessage> { ChatMessage.FromSystem(effectiveInstructions) };
            messages.AddRange(session.History.ToList()); // Use ToList() for a snapshot

            var completionRequest = new ChatCompletionCreateRequest
            {
                Messages = messages,
                // Use the constant from OpenAI.ObjectModels for safety if available, otherwise string is fine
                Model = "gpt-4o", // Assuming "gpt-4o" matches a constant or is the correct string identifier
                MaxTokens = 1024,
                Stream = true
            };

            _logger.LogInformation("Sending request to OpenAI for SessionId: {SessionId}", request.SessionId);

            // --- Streaming ---
            // Directly await foreach and yield. Exceptions from the internal method
            // will propagate up to the calling controller's try/catch block.
            // The try/catch/finally is REMOVED from around this loop.
            await foreach (var chunk in StreamOpenAIResponseChunksInternal(completionRequest, cancellationToken)
                                             .WithCancellation(cancellationToken))
            {
                // --- THIS IS THE YIELD ---
                yield return chunk;
            }

            // Log completion of yielding *within this specific method*.
            _logger.LogInformation("Finished yielding chunks from OpenAI within service for SessionId: {SessionId}", request.SessionId);

            // --- History Management Part 2 (Handled by Controller) ---
            // DO NOT update history with the assistant's response here.
            // The controller, after successfully consuming *all* chunks,
            // is responsible for calling UpdateHistoryAfterStream.
        }
        // --- End of CORRECTED StreamChatCompletionChunksAsync ---


        // Internal helper: Handles the raw stream interaction, yields data, throws on stream errors.
        // (This method remains unchanged and is correct)
        private async IAsyncEnumerable<string> StreamOpenAIResponseChunksInternal(
            ChatCompletionCreateRequest completionRequest,
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            var completionResult = _openAiService.ChatCompletion.CreateCompletionAsStream(completionRequest, cancellationToken: cancellationToken);

            await foreach (var completion in completionResult.WithCancellation(cancellationToken))
            {
                cancellationToken.ThrowIfCancellationRequested(); // Check for cancellation

                if (completion.Successful && completion.Choices.Count > 0)
                {
                    string? chunk = completion.Choices.First().Message.Content;
                    if (!string.IsNullOrEmpty(chunk))
                    {
                        yield return chunk; // Yield successful data chunk
                    }
                }
                else // OpenAI stream indicated an error
                {
                    string errorMessage;
                    if (completion.Error == null)
                    {
                        errorMessage = "Unknown error during OpenAI stream.";
                        _logger.LogWarning(errorMessage);
                    }
                    else
                    {
                        errorMessage = $"OpenAI API Error: {completion.Error.Message} (Code: {completion.Error.Code})";
                        _logger.LogError("OpenAI stream error: {Code} - {Message}", completion.Error.Code, completion.Error.Message);
                    }
                    // Throw exception to signal failure to the caller (the controller)
                    throw new Exception(errorMessage);
                }
            }
        }

        // Separate method to handle history update, called EXTERNALLY by the Controller.
        // (This method remains unchanged and is correct)
        public void UpdateHistoryAfterStream(string sessionId, string fullAssistantResponse)
        {
             if (string.IsNullOrWhiteSpace(fullAssistantResponse)) return; // Don't add empty responses

            if (SessionManager.Sessions.TryGetValue(sessionId, out var session))
            {
                 // Check if the last message isn't already this assistant response (idempotency)
                 if (session.History.LastOrDefault()?.Role?.ToLower() != "assistant" ||
                     session.History.LastOrDefault()?.Content != fullAssistantResponse)
                 {
                    session.History.Add(ChatMessage.FromAssistant(fullAssistantResponse));
                     _logger.LogInformation("Assistant response added to history for SessionId: {SessionId}", sessionId);

                    // Trim history after adding
                    const int maxHistoryItems = 20; // Keep last 10 pairs
                    if (session.History.Count > maxHistoryItems)
                    {
                        int itemsToRemove = session.History.Count - maxHistoryItems;
                        // Ensure we remove pairs if possible, starting from the oldest
                         if(itemsToRemove % 2 != 0 && session.History.Count > 1 && itemsToRemove > 0) {
                            itemsToRemove++; // Remove one extra user message to keep pairs if removing an odd number
                         }
                         // Prevent removing everything or negative counts
                        itemsToRemove = Math.Max(0, Math.Min(itemsToRemove, session.History.Count - 2)); // Keep at least one pair if possible

                        if (itemsToRemove > 0) {
                             session.History.RemoveRange(0, itemsToRemove);
                              _logger.LogInformation("Trimmed {Count} items from history for SessionId: {SessionId}", itemsToRemove, sessionId);
                        }
                    }
                 }
                 else
                 {
                     _logger.LogInformation("Duplicate assistant response detected or last message is already assistant. History not updated for SessionId: {SessionId}", sessionId);
                 }
            }
             else {
                 _logger.LogWarning("Attempted to update history for non-existent SessionId: {SessionId}", sessionId);
             }
        }
    }
}