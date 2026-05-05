import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import CanvasStage from '../CanvasStage';

describe('CanvasStage', () => {
  it('does not crash with null items or non-function render', () => {
    expect(() => {
      render(
        <CanvasStage
          width={390}
          height={844}
          items={[null, { id: 'a', x: 0, y: 0, w: 10, h: 10, render: 'nope' }]}
          setItems={() => {}}
          selectedId={null}
          setSelectedId={() => {}}
        />
      );
    }).not.toThrow();
  });
});

