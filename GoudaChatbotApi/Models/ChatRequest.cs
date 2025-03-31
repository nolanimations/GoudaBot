namespace GoudaChatbotApi.Models
{
    public class ChatRequest
    {
        public required string SessionId { get; set; }
        public required string Message { get; set; }
        public string? CustomInstructions { get; set; } // Can be null if not provided
    }
}