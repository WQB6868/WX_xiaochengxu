const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const https = require("https");

function fetchUrl(url) {
  return new Promise(function(resolve, reject) {
    https.get(url, { timeout: 8000 }, function(res) {
      var data = "";
      res.on("data", function(chunk) { data += chunk; });
      res.on("end", function() {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on("error", reject).on("timeout", function() {
      this.destroy();
      reject(new Error("timeout"));
    });
  });
}

// ============== 数据源 1: tmini.net API（主数据源） ==============
async function sourceTmini(province) {
  var json = await fetchUrl("https://tmini.net/api/oil-prices?province=" + encodeURIComponent(province));
  if (json.code !== 0 || !json.data || !json.data.prices) return null;
  var p = json.data.prices;
  return {
    p92: p["92号"] ? String(p["92号"].price) : "--",
    p95: p["95号"] ? String(p["95号"].price) : "--",
    p98: p["98号"] ? String(p["98号"].price) : (p["爱跑98"] ? String(p["爱跑98"].price) : "--"),
    p0: p["0号柴油"] ? String(p["0号柴油"].price) : "--",
    time: json.data.update_time ? json.data.update_time.substring(0, 10) : getTodayDate(),
    source: "tmini"
  };
}

// ============== 数据源 2: 52vmy API（备用） ==============
async function source52vmy(province) {
  var json = await fetchUrl("https://api.52vmy.cn/api/query/oil");
  if (json.code !== 200 || !json.data) return null;
  for (var i = 0; i < json.data.length; i++) {
    if (json.data[i].city === province) {
      return {
        p92: json.data[i]["92"] || "--",
        p95: json.data[i]["95"] || "--",
        p98: json.data[i]["98"] || "--",
        p0: json.data[i]["0"] || "--",
        time: getTodayDate(),
        source: "52vmy"
      };
    }
  }
  return null;
}

// ============== 兜底数据（基于发改委官方指导价） ==============
var FALLBACK = {
  "广东": { p92: "7.96", p95: "8.62", p98: "10.62", p0: "7.62" },
  "北京": { p92: "7.94", p95: "8.45", p98: "9.46", p0: "7.66" },
  "上海": { p92: "7.90", p95: "8.41", p98: "9.41", p0: "7.59" },
  "天津": { p92: "7.93", p95: "8.38", p98: "9.61", p0: "7.61" },
  "重庆": { p92: "7.99", p95: "8.45", p98: "9.52", p0: "7.67" },
  "山东": { p92: "7.90", p95: "8.48", p98: "9.20", p0: "7.52" },
  "浙江": { p92: "7.90", p95: "8.41", p98: "9.22", p0: "7.59" },
  "江苏": { p92: "7.91", p95: "8.41", p98: "9.31", p0: "7.57" },
  "四川": { p92: "8.02", p95: "8.58", p98: "9.32", p0: "7.65" },
  "湖南": { p92: "7.88", p95: "8.38", p98: "9.18", p0: "7.67" },
  "湖北": { p92: "7.94", p95: "8.50", p98: "9.41", p0: "7.59" },
  "河南": { p92: "7.95", p95: "8.49", p98: "9.14", p0: "7.59" },
  "河北": { p92: "7.93", p95: "8.38", p98: "9.20", p0: "7.61" },
  "福建": { p92: "7.91", p95: "8.44", p98: "9.24", p0: "7.60" },
  "海南": { p92: "9.05", p95: "9.62", p98: "10.89", p0: "7.70" },
  "陕西": { p92: "7.83", p95: "8.27", p98: "9.27", p0: "7.51" },
  "广西": { p92: "7.99", p95: "8.63", p98: "9.45", p0: "7.66" },
  "山西": { p92: "7.88", p95: "8.51", p98: "9.21", p0: "7.67" },
  "辽宁": { p92: "7.93", p95: "8.46", p98: "9.22", p0: "7.55" },
  "安徽": { p92: "7.89", p95: "8.45", p98: "9.28", p0: "7.64" },
  "江西": { p92: "7.90", p95: "8.48", p98: "9.98", p0: "7.66" },
  "云南": { p92: "8.08", p95: "8.68", p98: "9.36", p0: "7.68" },
  "贵州": { p92: "8.07", p95: "8.53", p98: "9.43", p0: "7.71" },
  "甘肃": { p92: "7.93", p95: "8.48", p98: "9.05", p0: "7.51" },
  "吉林": { p92: "7.90", p95: "8.53", p98: "9.27", p0: "7.53" },
  "黑龙江": { p92: "7.96", p95: "8.51", p98: "9.67", p0: "7.47" },
  "内蒙古": { p92: "7.87", p95: "8.40", p98: "9.22", p0: "7.47" },
  "新疆": { p92: "7.75", p95: "8.29", p98: "9.26", p0: "7.41" },
  "宁夏": { p92: "7.84", p95: "8.29", p98: "9.39", p0: "7.50" },
  "青海": { p92: "7.89", p95: "8.46", p98: "9.22", p0: "7.53" },
  "西藏": { p92: "8.82", p95: "9.34", p98: "10.41", p0: "8.16" }
};

// ============== 主函数 ==============
exports.main = async function(event, context) {
  var province = event.province || "广东";

  // 先尝试 tmini API
  try {
    var data = await sourceTmini(province);
    if (data && data.p92 !== "--") {
      return { code: 0, data: data };
    }
  } catch(e) {}

  // 再尝试 52vmy 备用
  try {
    var data = await source52vmy(province);
    if (data && data.p92 !== "--") {
      return { code: 0, data: data };
    }
  } catch(e) {}

  // 使用兜底数据
  var fallback = FALLBACK[province];
  if (fallback) {
    return {
      code: 0,
      data: {
        p92: fallback.p92, p95: fallback.p95,
        p98: fallback.p98 || "--", p0: fallback.p0,
        time: getTodayDate(),
        source: "参考"
      }
    };
  }

  return { code: 4001, message: "获取油价失败" };
};

function getTodayDate() {
  var d = new Date();
  var y = d.getFullYear();
  var m = (d.getMonth() + 1).toString().padStart(2, "0");
  var day = d.getDate().toString().padStart(2, "0");
  return y + "-" + m + "-" + day;
}
