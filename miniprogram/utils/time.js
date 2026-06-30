function formatDate(date) {
  var d = new Date(date);
  var year = d.getFullYear();
  var month = (d.getMonth() + 1);
  var day = d.getDate();
  return year + "-" + (month < 10 ? "0" : "") + month + "-" + (day < 10 ? "0" : "") + day;
}

function formatDateTime(date) {
  var d = new Date(date);
  return d.getFullYear() + "-" + ((d.getMonth()+1)<10?"0":"") + (d.getMonth()+1) + "-" + (d.getDate()<10?"0":"") + d.getDate() + " " + (d.getHours()<10?"0":"") + d.getHours() + ":" + (d.getMinutes()<10?"0":"") + d.getMinutes();
}

function formatChineseDate(dateStr) {
  if (!dateStr) return "";
  var parts = dateStr.split("-");
  return parseInt(parts[1]) + "月" + parseInt(parts[2]) + "日";
}

function getWeekDay(dateStr) {
  var days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  var d = new Date(dateStr);
  return days[d.getDay()];
}

function formatPrice(price) {
  if (price === 0 || price === "0") return "免费";
  return "¥" + price;
}

function timeAgo(date) {
  var now = Date.now();
  var diff = now - new Date(date).getTime();
  var minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return minutes + "分钟前";
  var hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "小时前";
  var days = Math.floor(hours / 24);
  if (days < 7) return days + "天前";
  return formatDate(date);
}

module.exports = {
  formatDate: formatDate, formatDateTime: formatDateTime,
  formatChineseDate: formatChineseDate, getWeekDay: getWeekDay,
  formatPrice: formatPrice, timeAgo: timeAgo
};
