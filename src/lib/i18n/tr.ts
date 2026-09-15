import en from "./en";

/**
 * Turkish translation table — rolled out incrementally, highest-traffic
 * sections first (see tri.ts's doc comment for the overall strategy).
 *
 * Structure: spread `en` first so every key that hasn't been translated yet
 * still resolves to correct, readable English rather than `undefined` —
 * exactly the same fallback philosophy `tri()`'s optional 5th argument
 * uses. Only keys that ARE translated below override that spread. As more
 * sections get real Turkish, move them out of "still English" and into a
 * real block, in the priority order agreed with the user: auth/landing →
 * CRM/pricing/reports → admin/rarely-used tools.
 */
const tr: typeof en = {
  ...en,

  // ── Auth: fully translated (highest-traffic pages) ──────────────────────
  auth: {
    login: {
      subtitle: "Hesabınıza giriş yapın",
      tabPhone: "Telefon",
      tabEmail: "E-posta",
      back: "Geri",
      otpTitle: "Doğrulama Kodu",
      otpSentPrefix: "Şu numaraya gönderilen 4 haneli kodu girin:",
      otpSentSuffix: "",
      testCode: "Test kodu:",
      phoneLabel: "Telefon numarası",
      sendCode: "Doğrulama kodu gönder",
      sending: "Gönderiliyor...",
      verifying: "Doğrulanıyor...",
      verifyAndLogin: "Doğrula ve giriş yap",
      resendCode: "Kodu tekrar gönder",
      emailLabel: "E-posta",
      passwordLabel: "Şifre",
      loggingIn: "Giriş yapılıyor...",
      submit: "Giriş yap",
      or: "Veya",
      googleLogin: "Google ile giriş yap",
      noAccount: "Hesabınız yok mu?",
      registerLink: "Kayıt ol",
      errPhoneInvalid: "Geçerli bir telefon numarası girin",
      otpSent: "Doğrulama kodu gönderildi",
      errSendFailed: "Kod gönderilemedi",
      errOtpLength: "4 haneli kodu girin",
      loginSuccess: "Giriş başarılı",
      errOtpWrong: "Kod yanlış",
      errFillEmailPass: "E-posta ve şifrenizi girin",
      errEmailPassWrong: "E-posta veya şifre yanlış",
    },
    register: {
      subtitle: "Yeni bir hesap oluşturun",
      selectedPack: "Seçilen paket:",
      nameLabel: "Ad Soyad *",
      namePlaceholder: "örn. Ahmet Yılmaz",
      firstNameLabel: "Ad *",
      firstNamePlaceholder: "Ahmet",
      lastNameLabel: "Soyad",
      lastNamePlaceholder: "Yılmaz",
      countryLabel: "Ülke",
      countryPlaceholder: "Ülke seçin",
      languageLabel: "Varsayılan dil",
      emailLabel: "E-posta",
      phoneLabel: "Telefon",
      passwordLabel: "Şifre",
      passwordPlaceholder: "En az 6 karakter",
      confirmPasswordLabel: "Şifreyi onayla",
      agreePrefix: "AiFekr'in",
      termsLink: "Kullanım Koşulları'nı",
      and: "ve",
      privacyLink: "Gizlilik Politikası'nı",
      agreeSuffix: "kabul ediyorum",
      creatingAccount: "Hesap oluşturuluyor...",
      submit: "Kayıt ol",
      googleRegister: "Google ile kayıt ol",
      haveAccount: "Zaten bir hesabınız var mı?",
      loginLink: "Giriş yap",
      errName: "Adınızı girin",
      errEmailOrPhone: "E-posta veya telefon numaranızı girin",
      errPasswordRequired: "Bir şifre girin",
      errPasswordMismatch: "Şifreler eşleşmiyor",
      errPasswordShort: "Şifre en az 6 karakter olmalıdır",
      errMustAgree: "Devam etmek için Kullanım Koşulları'nı kabul etmelisiniz",
      success: "Kayıt başarılı! Hoş geldiniz",
      errGeneric: "Kayıt başarısız oldu",
    },
  },
};

export default tr;
