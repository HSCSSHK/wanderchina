import { mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { describe, expect, it } from 'vitest'

import Placeholder from './Placeholder.vue'

describe('Placeholder', () => {
  it('渲染传入标题的占位页', () => {
    const wrapper = mount(Placeholder, {
      props: { title: 'Attractions Guide' },
      global: { plugins: [ElementPlus] },
    })
    expect(wrapper.text()).toContain('Attractions Guide')
  })
})
