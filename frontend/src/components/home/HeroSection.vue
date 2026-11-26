<script setup lang="ts">
// 首页 Hero：面向外国游客的品牌视觉 + 双导航入口（homepage-hero）。
// 无数据依赖：不 import src/api/、不发网络请求、纯客户端渲染（design D4）。
// 文案集中于此（i18n-ready，未接 i18n 库，design D5）。
const copy = {
  title: 'Wander China, Without the Guesswork',
  subtitle:
    'Structured guides, real-time answers, and a community — built for first-time international visitors to China.',
  ctaSpots: 'Explore Attractions',
  ctaAi: 'Ask AI Assistant',
}
</script>

<template>
  <section class="hero" data-testid="hero">
    <div class="hero__inner">
      <h1 class="hero__title" data-testid="hero-title">{{ copy.title }}</h1>
      <p class="hero__subtitle" data-testid="hero-subtitle">{{ copy.subtitle }}</p>
      <div class="hero__cta">
        <router-link to="/spots" data-testid="cta-spots">
          <el-button type="primary" size="large">{{ copy.ctaSpots }}</el-button>
        </router-link>
        <router-link to="/ai" data-testid="cta-ai">
          <el-button size="large">{{ copy.ctaAi }}</el-button>
        </router-link>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
// 品牌主色先用局部 SCSS 变量占位（design D3，留给品牌 change 精修）。
$hero-fg: #ffffff;
$hero-accent: #ff6a3d;
$hero-bg-from: #1b2a4a;
$hero-bg-to: #0f3d5c;

.hero {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 82vh;
  padding: clamp(24px, 6vw, 96px) clamp(16px, 5vw, 80px);
  // 视觉冲击力：大面积渐变打底，后续可叠加背景图占位。
  background: linear-gradient(135deg, $hero-bg-from 0%, $hero-bg-to 100%);
  color: $hero-fg;

  &__inner {
    max-width: 960px;
    text-align: center;
  }

  &__title {
    margin: 0 0 16px;
    font-size: clamp(32px, 6vw, 64px);
    line-height: 1.1;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  &__subtitle {
    margin: 0 auto 32px;
    max-width: 640px;
    font-size: clamp(16px, 2.4vw, 22px);
    line-height: 1.6;
    opacity: 0.92;
  }

  &__cta {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    justify-content: center;

    :deep(.el-button) {
      height: auto;
      padding: 14px 28px;
      font-size: 17px;
    }

    :deep(.el-button--primary) {
      background: $hero-accent;
      border-color: $hero-accent;
    }
  }
}
</style>
