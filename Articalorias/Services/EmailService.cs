using System.Net;
using System.Net.Mail;
using Articalorias.Configuration;
using Articalorias.Interfaces;
using Microsoft.Extensions.Options;

namespace Articalorias.Services;

public class EmailService : IEmailService
{
    private readonly SmtpSettings _smtp;

    public EmailService(IOptions<SmtpSettings> smtp)
    {
        _smtp = smtp.Value;
    }

    public async Task SendPasswordResetEmailAsync(string toEmail, string resetToken)
    {
        using var client = new SmtpClient(_smtp.Host, _smtp.Port)
        {
            Credentials = new NetworkCredential(_smtp.Username, _smtp.Password),
            EnableSsl = _smtp.EnableSsl
        };

        var message = new MailMessage
        {
            From = new MailAddress(_smtp.FromEmail, _smtp.FromName),
            Subject = "Articalorias – Password Reset",
            IsBodyHtml = true,
            Body = $"""
                <h2>Password Reset</h2>
                <p>You requested a password reset. Use the code below to set a new password.</p>
                <p style="font-size:24px;font-weight:bold;letter-spacing:2px;">{resetToken}</p>
                <p>This code expires in 15 minutes.</p>
                <p>If you did not request this, you can safely ignore this email.</p>
                """
        };

        message.To.Add(toEmail);

        await client.SendMailAsync(message);
    }
}
