# 阿里云 TTS 配置指南

本项目已集成阿里云语音合成服务，可提供更高质量的语音播报功能。

## 获取阿里云 TTS 凭证

1. **注册阿里云账号**
   - 访问 [阿里云官网](https://www.aliyun.com/)
   - 完成实名认证

2. **开通智能语音交互服务**
   - 进入阿里云控制台
   - 搜索"智能语音交互"或"语音合成"
   - 点击开通服务

3. **获取 AppKey 和 AccessKey**
   - 在智能语音交互控制台创建项目
   - 获取 AppKey
   - 获取 AccessKey ID 和 AccessKey Secret（推荐）
   - 或获取访问令牌 Token（静态方式，不推荐）

## 配置步骤

### 方式 1：使用 AccessKey（推荐）

Token 会自动获取和刷新，无需手动维护。

在项目根目录创建 `.env` 文件：

```env
# 阿里云 TTS 配置（推荐方式）
VITE_ALIYUN_APP_KEY=你的AppKey
VITE_ALIYUN_ACCESS_KEY_ID=你的AccessKeyId
VITE_ALIYUN_ACCESS_KEY_SECRET=你的AccessKeySecret
VITE_ALIYUN_VOICE=xiaoyun
```

**获取 AccessKey：**
1. 登录阿里云控制台
2. 点击右上角头像 -> AccessKey 管理
3. 创建 AccessKey（建议使用 RAM 子账号，仅授予语音服务权限）
4. 保存 AccessKey ID 和 AccessKey Secret

### 方式 2：使用静态 Token（不推荐）

Token 有有效期限制，过期后需要手动更新。

```env
# 阿里云 TTS 配置（静态 Token 方式）
VITE_ALIYUN_APP_KEY=你的AppKey
VITE_ALIYUN_TOKEN=你的Token
VITE_ALIYUN_VOICE=xiaoyun
```

### 方式 3：在代码中动态配置

```typescript
import { aliyunTTSService } from './services/aliyunTTSService';

// 使用 AccessKey（推荐）
aliyunTTSService.updateCredentials({
  accessKeyId: '你的AccessKeyId',
  accessKeySecret: '你的AccessKeySecret',
});

// 或使用静态 Token
aliyunTTSService.updateConfig({
  appKey: '你的AppKey',
  token: '你的Token',
});
```

## 常用音色列表

阿里云提供多种音色，以下是常用的中文音色：

| 音色名称 | 说明 | 适用场景 |
|---------|------|---------|
| xiaoyun | 女声-标准 | 通用场景 |
| aiqi | 女声-年轻 | 客服、助手 |
| aiayer | 女声-成熟 | 新闻播报 |
| ai Shen | 男声-年轻 | 知识讲解 |
| ai Xiaofeng | 男声-成熟 | 新闻播报 |
| naruto | 男声-动漫 | 娱乐内容 |

## 使用方法

1. 配置完成后，重启开发服务器：
   ```bash
   npm run dev
   ```

2. 在播放控制栏点击 🔊 图标启用语音
3. 点击 ⚙️ 图标打开设置
4. 选择"阿里云"作为 TTS 服务商

## 注意事项

- 阿里云 TTS 服务有免费额度限制
- 生产环境使用请关注费用情况
- 确保网络可以访问阿里云服务
- 如需更换音色，修改 `VITE_ALIYUN_VOICE` 环境变量

## 测试语音

可以在浏览器控制台执行以下代码测试：

```javascript
import { aliyunTTSService } from './src/services/aliyunTTSService';

// 检查是否配置
console.log('Aliyun TTS supported:', aliyunTTSService.isSupported);

// 测试语音
aliyunTTSService.speak('你好，这是一段测试语音');
```

## 故障排除

**问题：TTS 按钮不显示阿里云选项**

解决方案：
- 检查环境变量是否正确配置
- 确认 AppKey 和 Token 有效
- 查看浏览器控制台是否有错误信息

**问题：语音播放失败**

解决方案：
- 检查网络连接
- 确认阿里云服务是否正常
- 查看浏览器控制台的 CORS 错误

**问题：语音质量不佳**

解决方案：
- 尝试更换不同音色
- 调整语速参数
- 联系阿里云技术支持
