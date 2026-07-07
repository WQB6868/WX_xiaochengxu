/**
 * 油价数据爬虫 - 从 huangjinjiage.cn 解析全国油价
 * 
 * 用法: node oil-price-scraper.js [省份名称]
 * 示例: node oil-price-scraper.js 北京
 *       node oil-price-scraper.js 广东
 *       不加参数则输出所有省份
 */

const http = require('http');
const https = require('https');

// ====== 省份名称映射（页面名称 → 标准名称） ======
const PAGE_PROVINCE_MAP = {
  '北京':'北京','山东':'山东','上海':'上海','江苏':'江苏',
  '安徽':'安徽','福建':'福建','江西':'江西','湖北':'湖北',
  '广东':'广东','湖南':'湖南','广西':'广西','云南':'云南',
  '贵州':'贵州','海南':'海南','重庆':'重庆','四川':'四川',
  '天津':'天津','河北':'河北','山西':'山西','河南':'河南',
  '浙江':'浙江','吉林':'吉林','甘肃':'甘肃','青海':'青海',
  '宁夏':'宁夏','陕西':'陕西','辽宁':'辽宁','黑龙江':'黑龙江',
  '内蒙古':'内蒙古','拉萨':'西藏','乌鲁木齐':'新疆'
};

// ====== 获取 HTML ======
function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { timeout: 10000 }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        try {
          // Node.js 16+ 内置 TextDecoder 支持 gbk
          const decoder = new TextDecoder('gbk');
          resolve(decoder.decode(buffer));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject).on('timeout', function () {
      this.destroy();
      reject(new Error('请求超时'));
    });
  });
}

// ====== 解析油价数据 ======
function parseOilPrices(html) {
  // 提取日期
  let timeStr = '';
  const dateMatch = html.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (dateMatch) {
    timeStr = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
  }

  // 定位全国油价表格（第二个 class="bx" 的 table）
  const firstTable = html.indexOf('<table class="bx"');
  if (firstTable === -1) return null;
  const secondTable = html.indexOf('<table class="bx"', firstTable + 10);
  if (secondTable === -1) return null;
  
  const tbodyStart = html.indexOf('<tbody>', secondTable);
  const tbodyEnd = html.indexOf('</tbody>', tbodyStart);
  if (tbodyStart === -1 || tbodyEnd === -1) return null;
  
  const tbodyContent = html.substring(tbodyStart + 7, tbodyEnd);
  const rows = tbodyContent.split('<tr>');

  const result = { date: timeStr, provinces: {} };

  for (const row of rows) {
    const linkMatch = row.match(/<a[^>]*>([^<]+?)油价<\/a>/);
    if (!linkMatch) continue;
    
    const pageName = linkMatch[1];
    const provinceName = PAGE_PROVINCE_MAP[pageName];
    if (!provinceName) continue;

    // 提取价格列
    const priceMatches = row.match(/<td[^>]*>([^<]+)<\/td>/g);
    if (!priceMatches || priceMatches.length < 4) continue;

    const cleanValue = (v) => {
      v = v.replace(/<[^>]+>/g, '').trim();
      return (v === '-' || v === '—' || v === '') ? '--' : v;
    };

    result.provinces[provinceName] = {
      p92: cleanValue(priceMatches[0]),
      p95: cleanValue(priceMatches[1]),
      p98: cleanValue(priceMatches[2]),
      p0: cleanValue(priceMatches[3])
    };
  }

  return result;
}

// ====== 主流程 ======
async function main() {
  const targetProvince = process.argv[2]; // 可选参数：指定省份

  console.log('正在获取油价数据...\n');
  
  try {
    const html = await fetchHtml('http://www.huangjinjiage.cn/wiki/202207/0129537.html');
    const data = parseOilPrices(html);
    
    if (!data) {
      console.error('❌ 解析失败：无法定位油价表格');
      process.exit(1);
    }

    console.log(`📅 数据日期: ${data.date}`);
    console.log(`📍 省份总数: ${Object.keys(data.provinces).length}\n`);

    if (targetProvince) {
      // 查询指定省份
      const info = data.provinces[targetProvince];
      if (!info) {
        console.error(`❌ 未找到省份: ${targetProvince}`);
        process.exit(1);
      }
      console.log(`===== ${targetProvince} =====`);
      console.log(`  92# 汽油: ${info.p92} 元/升`);
      console.log(`  95# 汽油: ${info.p95} 元/升`);
      console.log(`  98# 汽油: ${info.p98} 元/升`);
      console.log(`  0# 柴油:  ${info.p0} 元/升`);
    } else {
      // 输出全部省份
      console.log('====== 全国油价一览表 ======\n');
      for (const [province, info] of Object.entries(data.provinces)) {
        console.log(
          `${province.padEnd(6)}  ` +
          `92# ${info.p92.padStart(5)}  ` +
          `95# ${info.p95.padStart(5)}  ` +
          `98# ${info.p98.padStart(5)}  ` +
          `0# ${info.p0.padStart(5)}`
        );
      }
    }

    // 输出 JSON 格式（方便程序使用）
    console.log('\n====== JSON 格式输出 ======');
    const output = targetProvince
      ? { date: data.date, province: targetProvince, ...data.provinces[targetProvince] }
      : { date: data.date, list: data.provinces };
    console.log(JSON.stringify(output, null, 2));

  } catch (err) {
    console.error(`❌ 请求失败: ${err.message}`);
    process.exit(1);
  }
}

main();
