import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
    service: "gmail", // Shortcut for Gmail's SMTP settings - see Well-Known Services
    auth: {
        type: "OAuth2",
        user: process.env.EMAIL_USER,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    },
});

transporter.verify((err, info) => {
    if (err) console.error('Error connecting to  email server', err)
    else console.log('Email server is ready to send message', info)
})

/**
 * Send an email
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Plain text content
 * @param {string} html - HTML content
 * @returns {Promise<void>}
*/

const sendEmail = async (to, subject,text, html) => {
    try {
        const info = await transporter.sendMail({
            from: `"Backend Ledger" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
            html
        })
        console.log('Message sent: %s', info.messageId)
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info))
    } catch (err) {
        console.error('Error sending email:', err)
    }
}

async function sendRegistrationEmail(userEmail, name) {
    const subject = 'Welcome to Backend Ledger'
    const text = `Hi ${name},\n\nThank you for registering at Backend Ledger! We're excited to have you on board.\n\nBest regards,\nThe Backend Ledger Team`
    const html = `<p>Hi ${name},</p><p>Thank you for registering at Backend Ledger! We're excited to have you on board.</p><p>Best regards,<br>The Backend Ledger Team</p>`
    await sendEmail(userEmail, subject, text, html)
}


export default {
    sendRegistrationEmail
}