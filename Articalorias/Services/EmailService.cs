using System.Net;
using System.Net.Mail;
using System.Net.Mime;
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

        var year = DateTime.UtcNow.Year;

        var plainBody = $"""
            ArtiCalorias — Reset your password

            We received a request to reset your ArtiCalorias password.

            Your reset code: {resetToken}

            Enter this 6-digit code on the ArtiCalorias reset password screen.
            This code expires in 15 minutes.

            If you didn't request this, you can safely ignore this email.
            Your password will not be changed.

            © {year} ArtiCalorias
            """;

        var htmlBody = $"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>Reset your password</title>
            </head>
            <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <!--[if mso]><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><![endif]-->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f4f4f5;padding:40px 16px;">
                <tr>
                  <td align="center">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
                      <!-- Brand -->
                      <tr>
                        <td style="padding:32px 32px 0;text-align:center;">
                          <p style="font-size:18px;font-weight:700;color:#4f46e5;margin:0;">ArtiCalorias</p>
                        </td>
                      </tr>
                      <!-- Heading -->
                      <tr>
                        <td style="padding:24px 32px 8px;text-align:center;">
                          <h1 style="font-size:20px;font-weight:600;color:#18181b;margin:0;">Reset your password</h1>
                        </td>
                      </tr>
                      <!-- Description -->
                      <tr>
                        <td style="padding:0 32px;text-align:center;">
                          <p style="font-size:14px;color:#52525b;line-height:1.6;margin:0 0 24px;">
                            We received a request to reset your ArtiCalorias password.<br />
                            Enter this code on the reset password screen:
                          </p>
                        </td>
                      </tr>
                      <!-- Code -->
                      <tr>
                        <td align="center" style="padding:0 32px 24px;">
                          <table cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td style="background-color:#eef2ff;border:2px dashed #a5b4fc;border-radius:8px;padding:16px 32px;">
                                <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#4338ca;font-family:'Courier New',Courier,monospace;">{resetToken}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <!-- Expiration -->
                      <tr>
                        <td style="padding:0 32px 24px;text-align:center;">
                          <p style="font-size:13px;color:#71717a;margin:0;">
                            This code expires in <strong style="color:#52525b;">15 minutes</strong>.
                          </p>
                        </td>
                      </tr>
                      <!-- Divider -->
                      <tr>
                        <td style="padding:0 32px;">
                          <hr style="border:none;border-top:1px solid #e4e4e7;margin:0;" />
                        </td>
                      </tr>
                      <!-- Safety note -->
                      <tr>
                        <td style="padding:20px 32px 32px;text-align:center;">
                          <p style="font-size:12px;color:#a1a1aa;line-height:1.5;margin:0;">
                            If you didn't request a password reset, you can safely ignore this email.
                            Your password will not be changed.
                          </p>
                        </td>
                      </tr>
                    </table>
                    <!-- Footer -->
                    <p style="font-size:11px;color:#a1a1aa;margin:24px 0 0;text-align:center;">
                      &copy; {year} ArtiCalorias. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
              <!--[if mso]></td></tr></table><![endif]-->
            </body>
            </html>
            """;

        var message = new MailMessage
        {
            From = new MailAddress(_smtp.FromEmail, _smtp.FromName),
            Subject = $"Your ArtiCalorias reset code: {resetToken}",
        };

        message.To.Add(toEmail);
        message.Headers.Add("X-Preheader", "Use this 6-digit code to reset your password.");

        var plainView = AlternateView.CreateAlternateViewFromString(plainBody, null, MediaTypeNames.Text.Plain);
        message.AlternateViews.Add(plainView);

        var htmlView = AlternateView.CreateAlternateViewFromString(htmlBody, null, MediaTypeNames.Text.Html);
        message.AlternateViews.Add(htmlView);

        await client.SendMailAsync(message);
    }
}
