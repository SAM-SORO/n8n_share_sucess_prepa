const E164 = /^\+[1-9]\d{7,14}$/;

function isValidPhone(phone) {
  return typeof phone === "string" && E164.test(phone);
}

module.exports = { isValidPhone };
