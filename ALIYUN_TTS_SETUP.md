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

3. **获取 AppKey 和 Token**
   - 在智能语音交互控制台创建项目
   - 获取 AppKey
   - 获取访问令牌（Token）

## 配置步骤

### 方式 1：创建 .env 文件

在项目根目录创建 `.env` 文件：

```env
# 阿里云 TTS 配置
VITE_ALIYUN_APP_KEY=你的AppKey
VITE_ALIYUN_TOKEN=你的Token
VITE_ALIYUN_VOICE=xiaoyun
```

### 方式 2：在代码中直接配置

编辑 `src/services/aliyunTTSService.ts`，修改默认配置：

```typescript
private config: AliyunTTSConfig = {
  appKey: '你的AppKey',
  token: '你的Token',
  voice: 'xiaoyun',
  volume: 50,
  speechRate: 0,
  pitchRate: 0,
};
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
