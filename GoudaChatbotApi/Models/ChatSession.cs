using OpenAI.ObjectModels.RequestModels;

namespace GoudaChatbotApi.Models
{
    public class ChatSession
    {
        public string CustomInstructions { get; set; } = "Je bent een behulpzame AI-assistent gespecialiseerd in activiteiten en revalidatiemogelijkheden in Gouda, Nederland. Reageer vriendelijk en informatief.";
        public List<ChatMessage> History { get; } = new List<ChatMessage>();
    }
}