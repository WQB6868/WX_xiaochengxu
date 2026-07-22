const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const https = require("https");
const http = require("http");

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

function fetchHtml(url) {
  return new Promise(function(resolve, reject) {
    var client = url.indexOf("https://") === 0 ? https : http;
    client.get(url, { timeout: 10000 }, function(res) {
      var chunks = [];
      res.on("data", function(chunk) { chunks.push(chunk); });
      res.on("end", function() {
        var buffer = Buffer.concat(chunks);
        try {
          var decoder = new TextDecoder("gbk");
          resolve(decoder.decode(buffer));
        } catch(e) {
          reject(e);
        }
      });
    }).on("error", reject).on("timeout", function() {
      this.destroy();
      reject(new Error("timeout"));
    });
  });
}

// ============== 省份名称映射（页面名称 → 标准名称） ==============
var PAGE_PROVINCE_MAP = {
  "北京":"北京","山东":"山东","上海":"上海","江苏":"江苏",
  "安徽":"安徽","福建":"福建","江西":"江西","湖北":"湖北",
  "广东":"广东","湖南":"湖南","广西":"广西","云南":"云南",
  "贵州":"贵州","海南":"海南","重庆":"重庆","四川":"四川",
  "天津":"天津","河北":"河北","山西":"山西","河南":"河南",
  "浙江":"浙江","吉林":"吉林","甘肃":"甘肃","青海":"青海",
  "宁夏":"宁夏","陕西":"陕西","辽宁":"辽宁","黑龙江":"黑龙江",
  "内蒙古":"内蒙古","拉萨":"西藏","乌鲁木齐":"新疆"
};

// ============== 数据源1: huangjinjiage.cn 网页爬虫（首选） ==============
async function sourceHuangjin(province) {
  var html;
  try {
    html = await fetchHtml("http://www.huangjinjiage.cn/wiki/202207/0129537.html");
  } catch(e) {
    return null;
  }

  // 提取日期
  var dateMatch = html.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  var timeStr = getTodayDate();
  if (dateMatch) {
    timeStr = dateMatch[1] + "-" + dateMatch[2].padStart(2,"0") + "-" + dateMatch[3].padStart(2,"0");
  }

  // 提取油价新闻内容
  var news = "";
  var newsStart = html.indexOf("今日油价最新消息：");
  if (newsStart > -1) {
    // 往前回溯最多20个字符，捕获日期前缀（如"2026年7月22日"）
    var dateStart = newsStart;
    for (var d = newsStart - 1; d >= newsStart - 20 && d >= 0; d--) {
      if (html.charCodeAt(d) <= 32) { dateStart = d + 1; break; }
      if (d === newsStart - 20 || d === 0) { dateStart = d; }
    }
    var snippet = html.substring(dateStart, newsStart + 500);
    news = snippet.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    var lastPeriod = news.lastIndexOf("\u3002");
    if (lastPeriod > -1) {
      news = news.substring(0, lastPeriod + 1);
    }
  }
  if (!news || news.length < 10) {
    news = "\u4eca\u65e5\u6cb9\u4ef7\u5df2\u66f4\u65b0\uff0c\u4ee5\u5b9e\u9645\u52a0\u6cb9\u7ad9\u4ef7\u683c\u4e3a\u51c6";
  }
  // 定位全国油价表格（第二个 class="bx" 的 table）
  var firstTable = html.indexOf('<table class="bx"');
  if (firstTable === -1) return null;
  var secondTable = html.indexOf('<table class="bx"', firstTable + 10);
  if (secondTable === -1) return null;

  var tbodyStart = html.indexOf("<tbody>", secondTable);
  var tbodyEnd = html.indexOf("</tbody>", tbodyStart);
  if (tbodyStart === -1 || tbodyEnd === -1) return null;

  var tbodyContent = html.substring(tbodyStart + 7, tbodyEnd);
  var rows = tbodyContent.split("<tr>");

  // 查找匹配省份
  var pageName = PAGE_PROVINCE_MAP[province];
  if (!pageName) return null;

  for (var i = 0; i < rows.length; i++) {
    var linkMatch = rows[i].match(/<a[^>]*>([^<]+?)油价<\/a>/);
    if (!linkMatch) continue;
    var cityName = linkMatch[1];
    var mappedProvince = PAGE_PROVINCE_MAP[cityName];
    if (!mappedProvince || mappedProvince !== province) continue;

    var cells = rows[i].match(/<td[^>]*>([^<]+)<\/td>/g);
    if (!cells || cells.length < 4) continue;

    var cleanValue = function(v) {
      v = v.replace(/<[^>]+>/g, "").trim();
      return (v === "-" || v === "—" || v === "") ? "--" : v;
    };

    return {
      p92: cleanValue(cells[0]),
      p95: cleanValue(cells[1]),
      p98: cleanValue(cells[2]),
      p0: cleanValue(cells[3]),
      time: timeStr,
      source: "huangjin",
      news: news,
      news: news
    };
  }

  return null;
}

// ============== 数据源2: tmini.net API（备用） ==============
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

// ============== 数据源3: 52vmy API（备用2） ==============
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
  // 检测是否为定时触发器调用（每日08:30），是则爬取全量省份
  if (event.TriggerName === "dailyOilPriceUpdate" || event.Type === "timer") {
    return await triggerDailyUpdate();
  }
  var province = event.province || "广东";
  var today = getTodayDate();
  var forceRefresh = event.forceRefresh === true;

  // 检查数据库缓存（除非强制刷新）
  if (!forceRefresh) {
    try {
      var cached = await db.collection("oil_prices").where({
        province: province,
        date: today
      }).get();
      if (cached.data && cached.data.length > 0) {
        var d = cached.data[0];
        return {
          code: 0,
          data: {
            p92: d.p92, p95: d.p95, p98: d.p98, p0: d.p0,
            time: d.time || today,
            source: d.source || "缓存",
            news: d.news || ""
          },
          cached: true
        };
      }
    } catch(e) {
      console.error("cache check error:", e);
    }
  }

  // 首选：huangjinjiage.cn 网页爬虫（数据最新最全）
  try {
    var data = await sourceHuangjin(province);
    if (data && data.p92 !== "--") {
      // 保存到数据库
      try {
        await db.collection("oil_prices").add({
          data: {
            province: province,
            date: today,
            p92: data.p92, p95: data.p95, p98: data.p98, p0: data.p0,
            time: data.time || today,
            source: data.source || "huangjin",
            news: data.news || "",
            updatedAt: db.serverDate()
          }
        });
      } catch(e) {
        console.error("save error:", e);
      }
      return { code: 0, data: data, cached: false };
    }
  } catch(e) {}

  // 备用1：tmini API
  try {
    var data = await sourceTmini(province);
    if (data && data.p92 !== "--") {
      return { code: 0, data: data };
    }
  } catch(e) {}

  // 备用2：52vmy API
  try {
    var data = await source52vmy(province);
    if (data && data.p92 !== "--") {
      return { code: 0, data: data };
    }
  } catch(e) {}

  // 最后：兜底数据
  var fallback = FALLBACK[province];
  if (fallback) {
    return {
      code: 0,
      data: {
        p92: fallback.p92, p95: fallback.p95,
        p98: fallback.p98 || "--", p0: fallback.p0,
        time: getTodayDate(),
        source: "参考价",
        news: ""
      }
    };
  }

  return { code: 4001, message: "获取油价失败" };
};

// ============== 定时触发：爬取所有省份并缓存 ==============
async function triggerDailyUpdate() {
  var allProvinces = Object.keys(PAGE_PROVINCE_MAP);
  var today = getTodayDate();
  var results = { success: 0, fail: 0, errors: [] };

  for (var i = 0; i < allProvinces.length; i++) {
    var p = allProvinces[i];
    try {
      var data = await sourceHuangjin(p);
      if (data && data.p92 !== "--") {
        try {
          // 先删除今日旧数据
          await db.collection("oil_prices").where({
            province: p,
            date: today
          }).remove();
        } catch(e) { /* ignore */ }
        // 保存新数据
        try {
          await db.collection("oil_prices").add({
            data: {
              province: p,
              date: today,
              p92: data.p92, p95: data.p95, p98: data.p98, p0: data.p0,
              time: data.time || today,
              source: data.source || "huangjin",
              news: data.news || "",
              updatedAt: db.serverDate()
            }
          });
          results.success++;
        } catch(e) {
          results.errors.push(p + " save: " + e.message);
          results.fail++;
        }
      } else {
        results.errors.push(p + " no data");
        results.fail++;
      }
    } catch(e) {
      results.errors.push(p + " fetch: " + e.message);
      results.fail++;
    }
  }

  return {
    code: 0,
    message: "daily update completed",
    results: results
  };
}

function getTodayDate() {
  var d = new Date();
  var y = d.getFullYear();
  var m = (d.getMonth() + 1).toString().padStart(2, "0");
  var day = d.getDate().toString().padStart(2, "0");
  return y + "-" + m + "-" + day;
}

