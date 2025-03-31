using Microsoft.AspNetCore.Mvc;
using GoudaChatbotApi.Models;
using GoudaChatbotApi.Services;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory; // Add Memory Cache namespace

namespace GoudaChatbotApi.Controllers
{
    // Define a model to hold context for streaming
    public class StreamContext
    {
        public required string SessionId { get; set; }
        public required string UserMessage { get; set; }
        public string? CustomInstructions { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class ChatController : ControllerBase
    {
        private readonly ChatService _chatService;
        private readonly ILogger<ChatController> _logger;
        private readonly IMemoryCache _cache; // Inject Memory Cache

        // Inject IMemoryCache
        public ChatController(ChatService chatService, ILogger<ChatController> logger, IMemoryCache cache)
        {
            _chatService = chatService;
            _logger = logger;
            _cache = cache;
        }

        // POST endpoint to INITIATE the chat stream
        [HttpPost("initiate")] // Changed route
        public IActionResult InitiateChatStream([FromBody] ChatRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.SessionId) || string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest("Invalid request payload.");
            }

            var streamId = Guid.NewGuid().ToString("N"); // Generate unique ID for this stream request
            var context = new StreamContext
            {
                SessionId = request.SessionId,
                UserMessage = request.Message,
                CustomInstructions = request.CustomInstructions
            };

            // Store context in cache with a short expiration (e.g., 1 minute)
            var cacheEntryOptions = new MemoryCacheEntryOptions()
                .SetSlidingExpiration(TimeSpan.FromMinutes(1)); // Adjust expiration as needed

            _cache.Set(streamId, context, cacheEntryOptions);

            _logger.LogInformation("Chat stream initiated. SessionId: {SessionId}, StreamId: {StreamId}", request.SessionId, streamId);

            // Return the streamId to the client
            return Ok(new { streamId = streamId });
        }


        // GET endpoint for EventSource to CONNECT to for streaming
        [HttpGet("stream/{streamId}")] // Route parameter for the ID
        [Produces("text/event-stream")] // Indicate SSE output
        public async Task GetChatStream(string streamId)
        {
             _logger.LogInformation("SSE GET request received for StreamId: {StreamId}", streamId);

            StreamContext? context = null; // Declare context outside the if block for finally access

            // Try to retrieve context from cache
            if (!_cache.TryGetValue(streamId, out context) || context == null)
            {
                _logger.LogWarning("Stream context not found or expired for StreamId: {StreamId}", streamId);
                Response.StatusCode = StatusCodes.Status404NotFound;
                await Response.WriteAsync($"event: error\ndata: Invalid or expired stream ID.\n\n");
                return; // Exit if context not found
            }

            // Optionally remove from cache once retrieved to prevent reuse
            // _cache.Remove(streamId);

             _logger.LogInformation("Stream context found for StreamId: {StreamId}, SessionId: {SessionId}. Starting OpenAI stream.", streamId, context.SessionId);

            Response.Headers.Append("Content-Type", "text/event-stream");
            Response.Headers.Append("Cache-Control", "no-cache");
            Response.Headers.Append("Connection", "keep-alive");

            var cancellationToken = HttpContext.RequestAborted;
            var fullResponseBuilder = new StringBuilder();
            bool streamSucceeded = false;

            try
            {
                // Create a ChatRequest-like object from the cached context
                var streamRequest = new ChatRequest
                {
                    SessionId = context.SessionId,
                    Message = context.UserMessage,
                    CustomInstructions = context.CustomInstructions
                };

                // Stream using the service method
                await foreach (var chunk in _chatService.StreamChatCompletionChunksAsync(streamRequest, cancellationToken)
                                                         .WithCancellation(cancellationToken))
                {
                    if (!string.IsNullOrEmpty(chunk))
                    {
                        fullResponseBuilder.Append(chunk); // Collect chunk
                        var formattedChunk = chunk.Replace("\n", "<br>");
                        await Response.WriteAsync($"data: {formattedChunk}\n\n", cancellationToken);
                        await Response.Body.FlushAsync(cancellationToken);
                    }
                }

                streamSucceeded = true; // Mark as successful only if loop completes without error
                 _logger.LogInformation("Successfully streamed response for StreamId: {StreamId}, SessionId: {SessionId}", streamId, context.SessionId);

                // Send stream close event
                await Response.WriteAsync($"event: close\ndata: Stream finished.\n\n", cancellationToken);
                await Response.Body.FlushAsync(cancellationToken);

            }
            catch (OperationCanceledException ex) // Client disconnected
            {
                _logger.LogWarning(ex, "Stream cancelled by client (RequestAborted) for StreamId: {StreamId}, SessionId: {SessionId}", streamId, context?.SessionId ?? "unknown"); // Use null conditional access
            }
            catch (Exception ex) // Error during streaming (e.g., from OpenAI)
            {
                _logger.LogError(ex, "Error during streaming chat response for StreamId: {StreamId}, SessionId: {SessionId}", streamId, context?.SessionId ?? "unknown"); // Use null conditional access
                try
                {
                    // Attempt to send error event to client
                     var errorPayload = JsonSerializer.Serialize(new { message = "Er is een serverfout opgetreden tijdens het streamen." });
                     // Use CancellationToken.None here in case the original token was the cause
                    await Response.WriteAsync($"event: error\ndata: {errorPayload}\n\n", CancellationToken.None);
                    await Response.Body.FlushAsync(CancellationToken.None);
                }
                catch (Exception writeEx) {
                    // Log if sending error message itself failed
                    _logger.LogError(writeEx, "Failed to write SSE error event to client for StreamId: {StreamId}", streamId);
                }
            }
            finally // This block always runs
            {
                // --- History Update Logic ---
                // Update history ONLY if the stream completed successfully AND we got a response
                // AND we still have the context (should always be true unless exception before retrieval)
                if (streamSucceeded && fullResponseBuilder.Length > 0 && context != null)
                {
                    try
                    {
                         // ** THE FIX IS HERE **
                         _logger.LogInformation("Calling UpdateHistoryAfterStream for SessionId: {SessionId}", context.SessionId);
                         // Call the service method to save the assistant's response
                         _chatService.UpdateHistoryAfterStream(context.SessionId, fullResponseBuilder.ToString());
                         // ** END OF FIX **
                    }
                    catch (Exception historyEx)
                    {
                        // Log errors during history update but don't let them crash the response flow further
                         _logger.LogError(historyEx, "Error updating chat history for SessionId: {SessionId} after stream completion.", context.SessionId);
                    }
                }
                 else if (!streamSucceeded) {
                     _logger.LogWarning("Stream did not complete successfully. History not updated for SessionId: {SessionId}", context?.SessionId ?? "unknown");
                 }
                 else if (context == null) {
                    // Should ideally not happen if retrieval worked, but good safeguard
                     _logger.LogWarning("Stream context was lost before history update. History not updated for StreamId: {StreamId}", streamId);
                 }
                 else { // Succeeded but empty response
                      _logger.LogInformation("Stream completed successfully but response was empty. History not updated for SessionId: {SessionId}", context.SessionId);
                 }
                 // --- End of History Update Logic ---

                  _logger.LogInformation("Finished processing SSE GET request for StreamId: {StreamId}", streamId);
                 // Connection should close automatically when the method returns
            }
        }
    }
}