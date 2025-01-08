export const customNodes = {
  'prompt-list': {
    label: "POM's Prompt List",
    module: 'text',
    action: 'input',
    category: 'input',
    type: 'promptList',
    params: {
      component: {
        type: 'component',
        display: 'component',
        value: 'PromptList',
        label: "POM's Prompt List"
      },
      prompts: {
        type: 'array',
        display: 'output',
        label: 'Prompts'
      }
    }
  },
  'generate-prompts': {
    label: "POM's Generate Prompts",
    module: 'text',
    action: 'generate',
    category: 'generation',
    type: 'generatePrompts',
    params: {
      component: {
        type: 'component',
        display: 'component',
        value: 'GeneratePrompts',
        label: "POM's Generate Prompts"
      },
      topic: {
        type: 'string',
        label: 'Topic'
      },
      examples: {
        type: 'array',
        label: 'Examples'
      },
      prompts: {
        type: 'array',
        display: 'output',
        label: 'Generated Prompts'
      }
    }
  },
  'image-generator': {
    label: 'POM\'s Simple Image Generator',
    module: 'image',
    action: 'generate',
    category: 'generation',
    type: 'imageGenerator',
    params: {
      component: {
        type: 'component',
        display: 'component',
        value: 'ImageGenerator',
        label: 'POM\'s Simple Image Generator'
      },
      prompt: {
        type: 'string',
        label: 'Prompt',
        display: 'input'
      },
      workflow: {
        type: 'string',
        label: 'Workflow',
        options: ['Flux General'],
        default: 'Flux General'
      },
      number: {
        type: 'number',
        label: 'Number of Images',
        min: 1,
        max: 12,
        default: 1
      },
      output: {
        type: 'array',
        display: 'hidden',
        label: 'Generated Images'
      }
    }
  },
  'image-gallery': {
    label: 'POM\'s Simple Gallery',
    module: 'image',
    action: 'display',
    category: 'display',
    type: 'imageGallery',
    params: {
      component: {
        type: 'component',
        display: 'component',
        value: 'ImageGallery',
        label: 'POM\'s Simple Gallery'
      },
      input: {
        type: 'array',
        display: 'input',
        label: 'Images'
      }
    }
  }
}; 