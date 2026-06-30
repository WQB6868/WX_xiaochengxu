function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

function isPositiveNumber(val) {
  var num = parseFloat(val);
  return !isNaN(num) && num >= 0;
}

function isIntegerInRange(val, min, max) {
  var num = parseInt(val);
  if (isNaN(num)) return false;
  return num >= min && num <= max;
}

function isNotEmpty(str) {
  return str && str.trim().length > 0;
}

function isValidDate(dateStr) {
  if (!dateStr) return false;
  var d = new Date(dateStr);
  return !isNaN(d.getTime());
}

function validateTripForm(form) {
  var errors = [];
  if (!isNotEmpty(form.fromCity)) errors.push("请选择出发城市");
  if (!isNotEmpty(form.toCity)) errors.push("请选择目的城市");
  if (!isNotEmpty(form.fromAddress)) errors.push("请选择出发地址");
  if (!isNotEmpty(form.toAddress)) errors.push("请选择目的地址");
  if (!isValidDate(form.departDate)) errors.push("请选择出发日期");
  if (!isNotEmpty(form.departTime)) errors.push("请选择出发时间");
  if (!isIntegerInRange(form.seats, 1, 4)) errors.push("座位数需在1-4之间");
  if (!isPositiveNumber(form.price)) errors.push("请输入有效费用");
  return errors;
}

module.exports = {
  isValidPhone: isValidPhone,
  isPositiveNumber: isPositiveNumber,
  isIntegerInRange: isIntegerInRange,
  isNotEmpty: isNotEmpty,
  isValidDate: isValidDate,
  validateTripForm: validateTripForm
};
