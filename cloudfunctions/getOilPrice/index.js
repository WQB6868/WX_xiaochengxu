const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
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
    var client = url.indexOf('https://') === 0 ? https : http;
    client.get(url, { timeout: 10000 }, function(res) {
      var chunks = [];
      res.on("data", function(chunk) { chunks.push(chunk); });
      res.on("end", function() {
        var buffer = Buffer.concat(chunks);
        try {
          var decoder = new TextDecoder('gbk');
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

// ============== 数据源1: tmini.net API（主数据源） ==============
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

// ============== 数据源2: 52vmy API（备用） ==============
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

// ============== 数据源3: huangjinjiage.cn 网页爬虫（备用2） ==============
var PROVINCE_MAP = {
  '北京':'北京','上海':'上海','天津':'天津','重庆':'重庆',
  '广东':'广东','山东':'山东','江苏':'江苏','浙江':'浙江',
  '福建':'福建','安徽':'安徽','江西':'江西','湖北':'湖北',
  '湖南':'湖南','河南':'河南','河北':'河北','山西':'山西',
  '四川':'四川','贵州':'贵州','云南':'云南','广西':'广西',
  '海南':'海南','陕西':'陕西','甘肃':'甘肃','青海':'青海',
  '宁夏':'宁夏','吉林':'吉林','辽宁':'辽宁','黑龙江':'黑龙江',
  '内蒙古':'内蒙古','西藏':'西藏','新疆':'新疆'
};

var PAGE_PROVINCE_MAP = {
  '北京':'北京','山东':'山东','上海':'上海','江苏':'江苏',
  '安徽':'安徽','福建':'福建','江西':'江西','湖北':'湖北',
  '广东':'广东','湖南':'湖南','广西':'广西','云南':'云南',
  '贵州':'贵州','海南':'海南','重庆':'重庆','四川':'四川',
  '天津':'天津','河北':'河北','山西':'山西','河南':'河南',
  '浙江':'浙江','吉林':'吉林','甘肃':'甘肃','青海':'青海',
  '宁夏':'宁夏','陕西':'陕西','辽宁':'辽宁','黑龙江':'黑龙江',
  '内蒙古':'内蒙古','拉萨':'西藏','乌鲁木齐':'新疆'
};

async function sourceHuangjin(province) {
  var url = "http://www.huangjinjiage.cn/wiki/202207/0129537.html";
  var html;
  try {
    html = await fetchHtml(url);
  } catch(e) {
    return null;
  }

  // 提取日期：从 "2026年07月06日今日油价" 中提取
  var dateMatch = html.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  var timeStr = getTodayDate();
  if (dateMatch) {
    timeStr = dateMatch[1] + '-' + dateMatch[2].padStart(2,'0') + '-' + dateMatch[3].padStart(2,'0');
  }

  // 查找全国油价表格：第二个 class="bx" 的 table
  var tableStart = html.indexOf('<table class="bx"');
  if (tableStart === -1) return null;
  var secondTable = html.indexOf('<table class="bx"', tableStart + 10);
  if (secondTable === -1) return null;
  var tbodyStart = html.indexOf('<tbody>', secondTable);
  if (tbodyStart === -1) return null;
  var tbodyEnd = html.indexOf('</tbody>', tbodyStart);
  if (tbodyEnd === -1) return null;
  var tbodyContent = html.substring(tbodyStart, tbodyEnd);

  // 映射省份名称
  var pageName = PAGE_PROVINCE_MAP[province];
  if (!pageName) return null;

  // 逐行解析
  var rows = tbodyContent.split('<tr>');
  for (var i = 0; i < rows.length; i++) {
    // 查找省份名称链接，如 <a href="...">北京油价</a> 或 <a href="...">拉萨油价</a>
    var linkMatch = rows[i].match(/<a[^>]*>([^<]+?)油价<\/a>/);
    if (!linkMatch) continue;
    var cityName = linkMatch[1];
    var mappedProvince = PAGE_PROVINCE_MAP[cityName];
    if (!mappedProvince || mappedProvince !== province) continue;

    // 提取价格
    var cells = rows[i].match(/<td[^>]*>([\d.-]+|—|-)<\/td>/g);
    if (!cells || cells.length < 4) continue;

    var p92 = cells[0].replace(/<[^>]+>/g, '');
    var p95 = cells[1].replace(/<[^>]+>/g, '');
    var p98 = cells[2].replace(/<[^>]+>/g, '');
    var p0 = cells[3].replace(/<[^>]+>/g, '');

    // 处理无效价格
    p92 = (p92 === '-' || p92 === '—') ? '--' : p92;
    p95 = (p95 === '-' || p95 === '—') ? '--' : p95;
    p98 = (p98 === '-' || p98 === '—') ? '--' : p98;
    p0 = (p0 === '-' || p0 === '—') ? '--' : p0;

    return {
      p92: p92,
      p95: p95,
      p98: p98,
      p0: p0,
      time: timeStr,
      source: "huangjin"
    };
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

  // 再尝试 huangjinjiage.cn 网页爬虫
  try {
    var data = await sourceHuangjin(province);
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
        source: "参考价"
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
