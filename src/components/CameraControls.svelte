<script>
  export let camera
</script>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    width: 150px;
    height: 150px;
  }

  .up {
    grid-column-start: 2;
  }
  .down {
    grid-column-start: 2;
    grid-row-start: 3;
  }
  .left,
  .right,
  .reset {
    grid-row-start: 2;
  }
  .right {
    grid-column-start: 3;
  }
</style>

<div class="grid">
  <button
    class="up"
    on:mousedown={() => camera.startMove('y')}
    on:mouseup={camera.stopMove}>^</button
  >
  <button
    class="left"
    on:mousedown={() => camera.startMove('x', false)}
    on:mouseup={camera.stopMove}>&lt;</button
  >
  <button class="reset" on:click={camera.reset}>o</button>
  <button
    class="right"
    on:mousedown={() => camera.startMove('x')}
    on:mouseup={camera.stopMove}>&gt;</button
  >
  <button
    class="down"
    on:mousedown={() => camera.startMove('y', false)}
    on:mouseup={camera.stopMove}>v</button
  >
</div>
