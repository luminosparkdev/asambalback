const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendActivationEmail = async (to, token, email) => {
  const link = `${process.env.FRONT_URL}/activar-cuenta?email=${encodeURIComponent(email)}&token=${token}`;

  const info = await transporter.sendMail({
    from: `"ASAMBAL" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Activa tu cuenta en ASAMBAL",
    html: `<p>Hola! Para activar tu cuenta hacé click en el link:</p>
           <a href="${link}">${link}</a>`,
  });

  console.log("Mail enviado:", info.messageId);
};

module.exports = { sendActivationEmail };
