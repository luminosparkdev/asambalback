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
    html: `<div style="background-color:#f3f4f6; padding:40px 0; font-family: Arial, sans-serif;">
    <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 10px 20px rgba(0,0,0,0.08);">

      <!-- Header -->
      <div style="background:#0f172a; padding:20px; text-align:center;">
        <h1 style="color:#ffffff; margin:0; font-size:22px; letter-spacing:1px;">
          ASAMBAL
        </h1>
      </div>

      <!-- Body -->
      <div style="padding:30px; color:#111827;">
        <h2 style="margin-top:0; font-size:20px;">
          ¡Bienvenido/a! 🏐
        </h2>

        <p style="font-size:14px; line-height:1.6; color:#374151;">
          Estás a un solo paso de activar tu cuenta en <strong>ASAMBAL</strong>.
          Hacé click en el botón de abajo para completar la activación.
        </p>

        <div style="text-align:center; margin:32px 0;">
          <a href="${link}"
             style="
               background-color:#22c55e;
               color:#ffffff;
               padding:14px 28px;
               text-decoration:none;
               border-radius:8px;
               font-weight:bold;
               font-size:15px;
               display:inline-block;
             ">
            Activar cuenta
          </a>
        </div>

        <p style="font-size:13px; color:#6b7280;">
          Si no solicitaste esta cuenta, podés ignorar este mensaje sin problema.
        </p>

        <!-- Fallback -->
        <p style="font-size:12px; color:#9ca3af; margin-top:20px;">
          Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br/>
          <a href="${link}" style="color:#2563eb; word-break:break-all;">
            ${link}
          </a>
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#f9fafb; padding:16px; text-align:center; font-size:11px; color:#6b7280;">
        © ${new Date().getFullYear()} ASAMBAL · Sistema de gestión deportiva
      </div>

    </div>
  </div>`
  
  });

  console.log("Mail enviado:", info.messageId);
};

module.exports = { sendActivationEmail };
