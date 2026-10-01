const { Resend } = require('resend');

/**
 * Sends a 6-digit OTP verification email via Resend API
 * @param {string} toEmail
 * @param {string} userName
 * @param {string} otpCode
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendOTPEmail = async (toEmail, userName, otpCode) => {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  // Always log OTP to server console in dev mode so developer can verify instantly
  console.log(`\n=============================================================`);
  console.log(`✉️  EMAIL OTP GENERATED`);
  console.log(`=============================================================`);
  console.log(`To: ${toEmail} (${userName})`);
  console.log(`OTP Code: ${otpCode}`);
  console.log(`Expires In: 10 Minutes`);
  console.log(`=============================================================\n`);

  if (!apiKey) {
    console.warn('⚠️  RESEND_API_KEY is not configured in server/.env. Using console logger fallback.');
    return { success: true, isMock: true };
  }

  try {
    const resend = new Resend(apiKey);
    const response = await resend.emails.send({
      from: `AdaptiveQuiz <${fromEmail}>`,
      to: [toEmail],
      subject: `Your Verification Code: ${otpCode} - AdaptiveQuiz`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #2563eb; margin: 0; font-size: 24px; font-weight: 700;">AdaptiveQuiz</h2>
            <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Email Account Verification</p>
          </div>
          
          <p style="color: #374151; font-size: 15px;">Hello <strong>${userName}</strong>,</p>
          <p style="color: #374151; font-size: 15px;">Thank you for registering on the AdaptiveQuiz platform. Please use the following 6-digit verification code to complete your registration:</p>
          
          <div style="background-color: #f3f4f6; border-radius: 6px; padding: 16px; text-align: center; margin: 24px 0;">
            <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8;">${otpCode}</span>
          </div>

          <p style="color: #6b7280; font-size: 13px; text-align: center;">This verification code will expire in <strong>10 minutes</strong>.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">If you did not request this code, please ignore this message.</p>
        </div>
      `,
    });

    if (response.error) {
      console.error('Resend API Error:', response.error);
      return { success: false, error: response.error.message };
    }

    console.log(`✅ Resend OTP email dispatched successfully to ${toEmail} (ID: ${response.data.id})`);
    return { success: true, messageId: response.data.id };
  } catch (err) {
    console.error('Error sending OTP email via Resend:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendOTPEmail };
