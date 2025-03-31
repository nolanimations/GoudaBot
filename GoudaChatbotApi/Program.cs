using GoudaChatbotApi.Services;
using OpenAI; // For OpenAiOptions
using Microsoft.Extensions.Configuration; // Needed for GetSection

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddMemoryCache(); // Keep MemoryCache for StreamContext

// --- OpenAI Configuration (Correct - No Change Needed) ---
// Binds settings from appsettings/environment variables to OpenAiOptions class
builder.Services.Configure<OpenAiOptions>(builder.Configuration.GetSection("OpenAISettings"));
// Register ChatService
builder.Services.AddScoped<ChatService>();

// --- CORRECTED CORS Configuration ---
// Read allowed origins from configuration (appsettings based on environment, overridden by env vars)
var allowedOrigins = builder.Configuration.GetSection("CorsSettings:AllowedOrigins").Value;

// Check if the configuration value exists and is not empty
if (string.IsNullOrEmpty(allowedOrigins))
{
    // Fallback or throw error if CORS origins are not configured
    Console.WriteLine("Warning: CORS AllowedOrigins not configured in appsettings or environment variables. Using restrictive fallback.");
    // Set a default (e.g., empty string to deny all, or throw exception)
    allowedOrigins = ""; // Example: Deny all if not configured
    // throw new InvalidOperationException("CorsSettings:AllowedOrigins must be configured in appsettings.json or environment variables.");
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", // Ensure this policy name matches app.UseCors() below
        policy =>
        {
             // Split the configured origins string by comma if multiple are allowed
             var origins = allowedOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries);
             if (origins.Length > 0)
             {
                Console.WriteLine($"Configuring CORS for Origins: {string.Join(", ", origins)}"); // Log configured origins
                policy.WithOrigins(origins) // Use origins from config
                      .AllowAnyHeader()
                      .AllowAnyMethod();
             }
             else
             {
                 // Log if no valid origins were found after splitting
                 Console.WriteLine("Warning: No valid CORS origins specified after parsing configuration. CORS policy will be highly restrictive.");
                 // Optionally define behavior like denying all:
                 // policy.WithOrigins("").AllowAnyHeader().AllowAnyMethod();
             }
        });
});
// --- End of CORRECTED CORS Configuration ---


var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseDeveloperExceptionPage(); // Show detailed errors in dev
}

// Optional: Enable HTTPS redirection if your App Service is configured for HTTPS
// app.UseHttpsRedirection();

app.UseRouting();

// Apply CORS policy using the name defined above
// MUST come after UseRouting and before UseAuthorization/MapControllers
app.UseCors("AllowFrontend");

// app.UseAuthorization(); // Uncomment if you add authorization later

app.MapControllers();

app.Run();