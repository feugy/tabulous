<script>
  import { BehaviorSubject } from 'rxjs'
  import { onDestroy } from 'svelte'

  export let mediaStream = null

  const levelDb = new BehaviorSubject()
  const audioContext = new AudioContext()
  const refreshDelayMs = 250

  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 512
  const samples = new Float32Array(analyser.fftSize)

  let input = null
  let timer = null

  $: if (mediaStream) {
    clearSoundMeter()
    input = audioContext.createMediaStreamSource(mediaStream)
    input.connect(analyser)
    scheduleSoundMeter()
  }

  onDestroy(clearSoundMeter)

  function clearSoundMeter() {
    clearTimeout(timer)
    input?.disconnect()
    analyser?.disconnect()
  }

  function scheduleSoundMeter() {
    timer = setTimeout(scheduleSoundMeter, refreshDelayMs)
    if (!analyser) {
      return
    }

    analyser.getFloatTimeDomainData(samples)
    let squareSum = 0
    for (const value of samples) {
      squareSum += value ** 2
    }
    levelDb.next(10 * Math.log10(squareSum / samples.length))
  }
</script>

<ol>
  <li class:on={$levelDb > -6} />
  <li class:on={$levelDb >= -12} />
  <li class:on={$levelDb >= -28} />
  <li class:on={$levelDb >= -36} />
</ol>

<style lang="postcss">
  ol {
    @apply list-none flex flex-col justify-center;
    gap: 2px;
  }

  li {
    @apply inline-block w-3 h-1.5 rounded-sm bg-$primary-light;
    &.on {
      @apply bg-$accent-warm;
    }
  }
</style>
