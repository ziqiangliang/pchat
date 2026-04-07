/**
 * PChat 配置文件
 * 集中管理所有硬编码值，便于维护和调整
 */

// ==================== 画布配置 ====================
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 500;
export const CENTER_X = CANVAS_WIDTH / 2;
export const CENTER_Y = CANVAS_HEIGHT / 2;

// ==================== 动画配置 ====================
// 时间线动画总时长 (毫秒)
export const TIMELINE_DURATION = 800;

// 节点动画时长 (毫秒)
export const NODE_ANIMATION_DURATION = 500;

// 步骤之间的基础间隔 (毫秒)
export const STEP_BASE_INTERVAL = 500;

// 时间线事件触发间隔 (毫秒)
export const TIMELINE_EVENT_DELAY = 300;

// 打字机效果配置
export const TYPING_BASE_DELAY = 50;    // 首次字符延迟 (毫秒)
export const TYPING_PER_CHAR_DELAY = 40; // 每个字符之间延迟 (毫秒)

// ==================== 布局配置 ====================
// 默认起始 X 坐标
export const DEFAULT_START_X = 150;

// 默认节点间距
export const DEFAULT_SPACING = 180;

// 水平间距
export const HORIZONTAL_SPACING = 120;

// 垂直间距
export const VERTICAL_SPACING = 100;

// 几何图形尺寸
export const GEOMETRY_SQUARE = 150;
export const GEOMETRY_TRIANGLE = 200;
export const GEOMETRY_CIRCLE = 120;

// 网络布局半径
export const NETWORK_RADIUS = 150;

// 网络布局根节点偏移
export const NETWORK_ROOT_OFFSET = 80;

// 流程布局层级间隔
export const FLOW_LEVEL_SPACING = 120;

// 数据布局配置
export const BAR_WIDTH = 80;
export const BAR_MAX_HEIGHT = 200;
export const BAR_BASE_Y = 350;

// ==================== 标注配置 ====================
// 标注默认偏移
export const ANNOTATION_OFFSET = 40;

// 角度标注偏移
export const ANGLE_ANNOTATION_OFFSET = 80;

// ==================== 节点样式配置 ====================
export const NODE_DEFAULT_OPACITY = 1;
export const NODE_HIGHLIGHT_STROKE_WIDTH = 3;
export const EDGE_HIGHLIGHT_STROKE_WIDTH = 3;

export const DEFAULT_NODE_LABEL_PADDING = 40;
export const DEFAULT_NODE_HEIGHT = 50;
export const DEFAULT_NODE_RADIUS = 20;

// ==================== 导出统一配置对象 ====================
export const config = {
  canvas: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    centerX: CENTER_X,
    centerY: CENTER_Y
  },
  animation: {
    timelineDuration: TIMELINE_DURATION,
    nodeAnimationDuration: NODE_ANIMATION_DURATION,
    stepBaseInterval: STEP_BASE_INTERVAL,
    timelineEventDelay: TIMELINE_EVENT_DELAY,
    typingBaseDelay: TYPING_BASE_DELAY,
    typingPerCharDelay: TYPING_PER_CHAR_DELAY
  },
  layout: {
    defaultStartX: DEFAULT_START_X,
    defaultSpacing: DEFAULT_SPACING,
    horizontalSpacing: HORIZONTAL_SPACING,
    verticalSpacing: VERTICAL_SPACING,
    geometrySquare: GEOMETRY_SQUARE,
    geometryTriangle: GEOMETRY_TRIANGLE,
    geometryCircle: GEOMETRY_CIRCLE,
    networkRadius: NETWORK_RADIUS,
    networkRootOffset: NETWORK_ROOT_OFFSET,
    flowLevelSpacing: FLOW_LEVEL_SPACING,
    barWidth: BAR_WIDTH,
    barMaxHeight: BAR_MAX_HEIGHT,
    barBaseY: BAR_BASE_Y
  },
  annotation: {
    offset: ANNOTATION_OFFSET,
    angleOffset: ANGLE_ANNOTATION_OFFSET
  },
  node: {
    defaultOpacity: NODE_DEFAULT_OPACITY,
    highlightStrokeWidth: NODE_HIGHLIGHT_STROKE_WIDTH,
    edgeHighlightStrokeWidth: EDGE_HIGHLIGHT_STROKE_WIDTH,
    defaultLabelPadding: DEFAULT_NODE_LABEL_PADDING,
    defaultHeight: DEFAULT_NODE_HEIGHT,
    defaultRadius: DEFAULT_NODE_RADIUS
  }
};