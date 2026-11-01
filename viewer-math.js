(() => {
  'use strict';
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const fitScale = (viewWidth, viewHeight, width, height) => Math.min(1, Math.max(1, viewWidth) / width, Math.max(1, viewHeight) / height);
  function layout(viewWidth, viewHeight, width, height, scale) {
    const imageWidth = width * scale, imageHeight = height * scale;
    return {
      viewWidth, viewHeight, scale,
      imageWidth, imageHeight,
      width: Math.max(viewWidth, imageWidth), height: Math.max(viewHeight, imageHeight),
      x: Math.max(0, (viewWidth - imageWidth) / 2), y: Math.max(0, (viewHeight - imageHeight) / 2)
    };
  }
  function imagePoint(box, left, top, point) {
    return { x: (left + point.x - box.x) / box.scale, y: (top + point.y - box.y) / box.scale };
  }
  function scrollPosition(box, point, image) {
    return {
      left: clamp(image.x * box.scale + box.x - point.x, 0, Math.max(0, box.width - box.viewWidth)),
      top: clamp(image.y * box.scale + box.y - point.y, 0, Math.max(0, box.height - box.viewHeight))
    };
  }
  window.PortfolioZoomMath = { clamp, fitScale, layout, imagePoint, scrollPosition };
})();
