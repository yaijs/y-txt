import test from 'node:test';
import assert from 'node:assert/strict';

import bundledTools from '../src/tools/tools.json' with { type: 'json' };
import bundledModels from '../src/models.json' with { type: 'json' };
import { getToolSteps, validateCategories, validateModelSets } from '../src/config/index.js';

test('bundled tool config validates', () => {
  const categories = validateCategories(bundledTools);
  assert.ok(categories.length > 0);
  assert.ok(categories.some(category => category.tools.some(tool => tool.id === 'proofread_translate')));
});

test('bundled model config validates', () => {
  const models = validateModelSets(bundledModels);
  assert.ok(models.default);
  assert.equal(typeof models.default.nvidia, 'string');
});

test('validateCategories rejects duplicate tool ids', () => {
  assert.throws(() => validateCategories([
    {
      id: 'cat_a',
      label: 'A',
      tools: [
        {
          id: 'duplicate',
          name: 'First',
          systemPrompt: 'A',
          userMessage: 'B'
        }
      ]
    },
    {
      id: 'cat_b',
      label: 'B',
      tools: [
        {
          id: 'duplicate',
          name: 'Second',
          systemPrompt: 'A',
          userMessage: 'B'
        }
      ]
    }
  ]), /Duplicate tool id/);
});

test('validateCategories rejects invalid placeholder ids', () => {
  assert.throws(() => validateCategories([
    {
      id: 'main',
      label: 'Main',
      tools: [
        {
          id: 'tool',
          name: 'Tool',
          systemPrompt: 'A',
          userMessage: 'B',
          options: [
            {
              id: 'not-valid-id',
              label: 'Bad',
              type: 'text'
            }
          ]
        }
      ]
    }
  ]), /must match/);
});

test('getToolSteps wraps single-step tools into a pipeline', () => {
  const [step] = getToolSteps({
    id: 'spell',
    name: 'Spell',
    systemPrompt: 'Fix',
    userMessage: '{{input}}'
  });

  assert.equal(step.id, 'result');
  assert.equal(step.name, 'Spell');
});

test('getToolSteps preserves explicit pipeline steps', () => {
  const steps = getToolSteps({
    id: 'pipeline',
    name: 'Pipeline',
    steps: [
      {
        id: 'first_step',
        name: 'First',
        systemPrompt: 'One',
        userMessage: '{{input}}'
      },
      {
        id: 'second_step',
        name: 'Second',
        systemPrompt: 'Two',
        userMessage: '{{previous}}'
      }
    ]
  });

  assert.equal(steps.length, 2);
  assert.equal(steps[1]?.id, 'second_step');
});
