# Agent Guidelines for HomeTogether

## Critical Lessons Learned (DO NOT REPEAT)

### Flexbox Vertical Alignment: NEVER use <text> for emoji+CJK alignment

When vertically aligning emoji with Chinese text inside a flex container:
- **WRONG**: <text>emoji</text> inside display:flex;align-items:center
  Reason: <text> has its own line-height model. Flexbox centers the <text> box,
  but glyphs inside are positioned by font baseline (different for emoji vs CJK).
  No amount of line-height fiddling can fix this.

- **CORRECT**: Put emoji/text directly inside <view> (as anonymous flex items):
  <view class="holder">📅</view>
  <view class="holder">????</view>
  .holder { display:flex; align-items:center; height:56rpx; }
  Flexbox centers the anonymous text node by geometric box center,
  completely independent of font baselines.

- **Rule of thumb**: If visual centering of mixed-script content is needed,
  always use display:flex on a <view> (never <text>) and let flexbox center
  the anonymous text node. Do NOT add line-height to "fix" it.

### WXML/WXSS Encoding Rules
- WXML files MUST have UTF-8 BOM
- WXSS files MUST NOT have UTF-8 BOM
- Use encoding="utf-8-sig" for reading WXML, encoding="utf-8" for writing WXSS

### WXML Tag Rules
- Every <view> needs a matching </view>
- Every <block> needs a matching </block>
- Every <text> needs a matching </text> (NOT </view>)
- wx:if/wx:elif/wx:else must be siblings under the same parent
- After any WXML edit, verify tag balance before claiming completion