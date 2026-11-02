/**
 * Intro timeline config (v9). v9: sharp car / floor base frames (4x-UltraSharp detail, native micro-texture, q95 4:4:4),
 * always-1:1 layer cache, lighter haze. v8: audio = the official AMG start recording only (no Pixabay crank, no press-master
 * layer, no resampling / synthetic crackle), catch 2.90, blips 5.46 / 6.87 / 8.52; physical amber floor reflection;
 * texture pass on all layers. v7: ~0.6 s longer real starter crank (engine start 2.30 -> 2.90), much more powerful
 * catch + blips (v7 audio) with audio-driven FX (shake / light surge / red pulse / bloom + vignette / floor flicker),
 * realistic amber floor reflection. v6: longer / more powerful ignition audio (engine_v6), blips 0.8 s later, scroll cue later. All times in SECONDS from page start (t = 0 when the layers are ready; no gate).
 * Sequence: darkness -> unlock flash -> double flash + red bloom (silent)
 *           -> AMG starter from 2.57 -> ENGINE START (t = 2.90): ignition hit locked to DRL / grille LED / slats / star / micro-shake
 *           -> emblem on the next engine hit -> 3 throttle blips (5.46 / 6.87 / 8.52 s) + full decay -> real V8 IDLE loop (x-fade ~10.8-11.7 s, until the user scrolls).
 * Audio is decoded in the background; it starts on the first user gesture (or immediately where autoplay is
 * allowed) at the position that matches the visual timeline.
 */
window.INTRO_CONFIG = {
  // Entry screen: key fob before the intro. Tapping the fob (or its unlock button) plays the key click + central-locking
  // chirp, unlocks the AudioContext inside that gesture (iOS-safe) and starts the intro with sound. Drop the real render
  // in at `src` (transparent PNG/WebP, any size) and set `hotspot` to its unlock button.
  fob: {
    enabled: true,
    src: 'assets/ui/key_fob.webp',     // 1x (320x619), transparent; Natan's front render cut from black (tools/make_fob.py)
    src2x: 'assets/ui/key_fob@2x.webp', // 2x (640x1238), used on hi-dpi screens
    placeholder: false,                // true shows a small 'placeholder' label (code-drawn stand-in: tools/make_fob_placeholder.py)
    height: 'min(64vh, 620px)',        // displayed fob height (CSS length); width follows the image aspect
    maxWidth: '72vw',
    // press sound: real recording, 2026 Mercedes-Benz Sprinter central locking (Freesound #873239 by Robo9418, CC0),
    // trimmed / denoised / ~-16 LUFS (tools/make_fob_sound.sh). '' falls back to the synthesised click + thunk.
    sound: 'assets/audio/fob_unlock.mp3', soundGain: 0.9,
    rim: 'assets/ui/key_fob_rim.webp', // rim-light mask (edges / chrome highlights, alpha) for the entrance light sweep + sheen
    // unlock (middle) button outline, traced from key_fob@2x.webp (tools/btn_contour.py), in image px (viewBox 0 0 w h):
    // edge = the button's own contour, inner / outer = the precise double line 3.5 px inside / 3 px outside it
    button: { w: 640, h: 1238,
      edge: 'M201.0 684.4 L197.0 684.9 L193.0 685.0 L189.0 685.0 L185.0 685.0 L181.0 685.0 L177.0 685.0 L173.0 685.0 L169.0 685.0 L165.0 685.0 L161.0 685.0 L157.1 685.3 L153.7 687.3 L152.2 691.0 L152.6 695.0 L153.1 698.9 L153.5 702.9 L154.2 706.8 L154.6 710.8 L155.3 714.8 L155.7 718.7 L156.4 722.7 L156.9 726.6 L157.5 730.6 L158.1 734.5 L158.6 738.5 L159.3 742.4 L159.7 746.4 L160.4 750.3 L160.8 754.3 L161.5 758.3 L162.0 762.2 L162.6 766.2 L163.3 770.1 L163.8 774.1 L164.4 778.0 L165.1 782.0 L165.7 785.9 L166.3 789.9 L166.8 793.8 L167.4 797.8 L167.9 801.7 L168.5 805.7 L169.2 809.6 L169.8 813.6 L170.5 817.5 L171.3 821.4 L172.9 825.0 L176.1 827.4 L180.0 828.0 L184.0 828.0 L188.0 828.0 L192.0 828.0 L196.0 828.0 L200.0 828.0 L204.0 828.0 L208.0 828.0 L212.0 828.0 L216.0 828.0 L220.0 828.0 L224.0 828.0 L228.0 828.0 L232.0 828.0 L236.0 828.0 L240.0 828.0 L244.0 828.0 L248.0 828.0 L252.0 828.0 L256.0 828.0 L260.0 828.0 L264.0 828.0 L268.0 828.0 L272.0 827.6 L276.0 827.1 L280.0 827.0 L284.0 827.0 L288.0 827.0 L292.0 827.0 L296.0 827.0 L300.0 827.0 L304.0 827.0 L308.0 827.0 L312.0 827.0 L316.0 827.0 L320.0 827.0 L324.0 827.0 L328.0 827.0 L332.0 827.0 L336.0 827.0 L340.0 827.0 L343.9 827.3 L347.9 827.8 L351.9 828.0 L355.9 828.0 L359.9 828.0 L363.9 828.0 L367.9 828.0 L371.9 828.0 L375.9 828.0 L379.9 828.0 L383.9 828.0 L387.9 828.0 L391.9 828.0 L395.9 828.0 L399.9 828.0 L403.9 828.0 L407.9 828.0 L411.9 828.0 L415.9 828.0 L419.9 828.0 L423.9 828.0 L427.9 828.0 L431.9 828.0 L435.9 828.0 L439.9 828.0 L443.9 828.0 L447.9 828.0 L451.9 828.0 L455.9 828.0 L459.9 828.0 L463.8 827.3 L466.8 824.7 L468.3 821.1 L469.1 817.1 L469.6 813.2 L470.5 809.3 L471.4 805.4 L472.2 801.5 L472.8 797.5 L473.5 793.6 L474.0 789.6 L474.5 785.6 L475.2 781.7 L475.7 777.7 L476.2 773.8 L476.7 769.8 L477.3 765.9 L477.8 761.9 L478.3 757.9 L478.8 754.0 L479.4 750.0 L479.9 746.0 L480.4 742.1 L480.9 738.1 L481.3 734.1 L481.8 730.2 L482.3 726.2 L482.8 722.2 L483.2 718.3 L483.6 714.3 L484.2 710.3 L484.6 706.3 L485.0 702.4 L485.0 698.4 L485.0 694.4 L484.9 690.4 L483.6 686.7 L480.3 684.4 L476.4 684.0 L472.4 684.0 L468.4 684.0 L464.4 684.0 L460.4 684.0 L456.4 684.0 L452.4 684.0 L448.4 684.0 L444.4 684.0 L440.4 684.0 L436.4 684.0 L432.4 684.0 L428.4 684.0 L424.4 684.0 L420.4 684.0 L416.4 684.0 L412.4 684.0 L408.4 684.0 L404.4 684.0 L400.4 684.0 L396.4 684.0 L392.4 684.0 L388.4 684.0 L384.4 684.0 L380.4 684.0 L376.4 684.0 L372.4 684.0 L368.4 684.0 L364.4 684.0 L360.4 684.0 L356.4 684.0 L352.4 684.0 L348.4 684.0 L344.4 684.0 L340.4 684.0 L336.4 684.0 L332.4 684.0 L328.4 684.0 L324.4 684.0 L320.4 684.0 L316.4 684.0 L312.4 684.0 L308.4 684.0 L304.4 684.0 L300.4 684.0 L296.4 684.0 L292.4 684.0 L288.4 684.0 L284.4 684.0 L280.4 684.0 L276.4 684.0 L272.4 684.0 L268.4 684.0 L264.4 684.0 L260.4 684.0 L256.4 684.0 L252.4 684.0 L248.4 684.0 L244.4 684.0 L240.4 684.0 L236.4 684.0 L232.4 684.0 L228.4 684.0 L224.4 684.0 L220.4 684.0 L216.4 684.0 L212.4 684.0 L208.4 684.0 L204.4 684.1Z',
      inner: 'M202.0 687.4 L198.0 687.9 L194.0 688.0 L190.0 688.0 L186.0 688.0 L182.0 688.0 L178.0 688.0 L174.0 688.0 L170.0 688.0 L166.0 688.0 L162.0 688.0 L158.1 688.4 L155.5 691.2 L155.7 695.2 L156.2 699.1 L156.7 703.1 L157.3 707.0 L157.8 711.0 L158.4 714.9 L159.0 718.9 L159.5 722.9 L160.2 726.8 L160.6 730.8 L161.3 734.7 L161.7 738.7 L162.4 742.6 L162.9 746.6 L163.5 750.5 L164.1 754.5 L164.6 758.5 L165.3 762.4 L165.7 766.4 L166.5 770.3 L167.1 774.2 L167.6 778.2 L168.3 782.1 L168.8 786.1 L169.4 790.0 L170.0 794.0 L170.6 798.0 L171.2 801.9 L171.7 805.9 L172.4 809.8 L173.1 813.7 L173.6 817.7 L174.6 821.5 L177.3 824.4 L181.2 825.0 L185.2 825.0 L189.2 825.0 L193.2 825.0 L197.2 825.0 L201.2 825.0 L205.2 825.0 L209.2 825.0 L213.2 825.0 L217.2 825.0 L221.2 825.0 L225.2 825.0 L229.2 825.0 L233.2 825.0 L237.2 825.0 L241.2 825.0 L245.2 825.0 L249.2 825.0 L253.2 825.0 L257.2 825.0 L261.2 825.0 L265.2 825.0 L269.2 824.8 L273.2 824.3 L277.2 824.0 L281.2 824.0 L285.2 824.0 L289.2 824.0 L293.2 824.0 L297.2 824.0 L301.2 824.0 L305.2 824.0 L309.2 824.0 L313.2 824.0 L317.2 824.0 L321.2 824.0 L325.2 824.0 L329.2 824.0 L333.2 824.0 L337.2 824.0 L341.2 824.0 L345.2 824.4 L349.1 824.8 L353.1 825.0 L357.1 825.0 L361.1 825.0 L365.1 825.0 L369.1 825.0 L373.1 825.0 L377.1 825.0 L381.1 825.0 L385.1 825.0 L389.1 825.0 L393.1 825.0 L397.1 825.0 L401.1 825.0 L405.1 825.0 L409.1 825.0 L413.1 825.0 L417.1 825.0 L421.1 825.0 L425.1 825.0 L429.1 825.0 L433.1 825.0 L437.1 825.0 L441.1 825.0 L445.1 825.0 L449.1 825.0 L453.1 825.0 L457.1 825.0 L461.1 824.6 L464.3 822.3 L465.6 818.6 L466.4 814.7 L467.0 810.7 L467.8 806.8 L468.7 802.9 L469.4 799.0 L470.1 795.1 L470.7 791.1 L471.2 787.1 L471.6 783.2 L472.4 779.2 L472.9 775.3 L473.4 771.3 L473.9 767.3 L474.5 763.4 L475.0 759.4 L475.5 755.5 L476.1 751.5 L476.6 747.5 L477.2 743.6 L477.6 739.6 L478.0 735.6 L478.5 731.7 L479.0 727.7 L479.5 723.7 L479.9 719.8 L480.4 715.8 L480.8 711.8 L481.4 707.8 L481.8 703.9 L482.0 699.9 L482.0 695.9 L482.0 691.9 L480.5 688.3 L476.8 687.0 L472.8 687.0 L468.8 687.0 L464.8 687.0 L460.8 687.0 L456.8 687.0 L452.8 687.0 L448.8 687.0 L444.8 687.0 L440.8 687.0 L436.8 687.0 L432.8 687.0 L428.8 687.0 L424.8 687.0 L420.8 687.0 L416.8 687.0 L412.8 687.0 L408.8 687.0 L404.8 687.0 L400.8 687.0 L396.8 687.0 L392.8 687.0 L388.8 687.0 L384.8 687.0 L380.8 687.0 L376.8 687.0 L372.8 687.0 L368.8 687.0 L364.8 687.0 L360.8 687.0 L356.8 687.0 L352.8 687.0 L348.8 687.0 L344.8 687.0 L340.8 687.0 L336.8 687.0 L332.8 687.0 L328.8 687.0 L324.8 687.0 L320.8 687.0 L316.8 687.0 L312.8 687.0 L308.8 687.0 L304.8 687.0 L300.8 687.0 L296.8 687.0 L292.8 687.0 L288.8 687.0 L284.8 687.0 L280.8 687.0 L276.8 687.0 L272.8 687.0 L268.8 687.0 L264.8 687.0 L260.8 687.0 L256.8 687.0 L252.8 687.0 L248.8 687.0 L244.8 687.0 L240.8 687.0 L236.8 687.0 L232.8 687.0 L228.8 687.0 L224.8 687.0 L220.8 687.0 L216.8 687.0 L212.8 687.0 L208.8 687.0 L204.8 687.1Z',
      outer: 'M201.0 681.4 L197.0 681.9 L193.0 682.0 L189.0 682.0 L185.0 682.0 L181.0 682.0 L177.0 682.0 L173.0 682.0 L169.0 682.0 L165.0 682.0 L161.0 682.0 L157.0 682.2 L153.3 683.6 L150.6 686.5 L149.2 690.2 L149.5 694.2 L149.9 698.2 L150.5 702.1 L151.0 706.1 L151.6 710.0 L152.2 714.0 L152.7 717.9 L153.3 721.9 L153.8 725.9 L154.4 729.8 L154.9 733.8 L155.5 737.7 L156.1 741.7 L156.6 745.6 L157.3 749.6 L157.7 753.5 L158.4 757.5 L158.9 761.4 L159.5 765.4 L160.2 769.3 L160.7 773.3 L161.4 777.2 L161.9 781.2 L162.6 785.1 L163.2 789.1 L163.7 793.0 L164.3 797.0 L164.8 801.0 L165.4 804.9 L166.1 808.8 L166.6 812.8 L167.4 816.7 L168.0 820.7 L169.2 824.5 L171.4 827.8 L174.7 830.1 L178.5 830.9 L182.5 831.0 L186.5 831.0 L190.5 831.0 L194.5 831.0 L198.5 831.0 L202.5 831.0 L206.5 831.0 L210.5 831.0 L214.5 831.0 L218.5 831.0 L222.5 831.0 L226.5 831.0 L230.5 831.0 L234.5 831.0 L238.5 831.0 L242.5 831.0 L246.5 831.0 L250.5 831.0 L254.5 831.0 L258.5 831.0 L262.5 831.0 L266.5 831.0 L270.5 830.7 L274.5 830.3 L278.5 830.0 L282.5 830.0 L286.5 830.0 L290.5 830.0 L294.5 830.0 L298.5 830.0 L302.5 830.0 L306.5 830.0 L310.5 830.0 L314.5 830.0 L318.5 830.0 L322.5 830.0 L326.5 830.0 L330.5 830.0 L334.5 830.0 L338.5 830.0 L342.5 830.2 L346.5 830.6 L350.4 831.0 L354.4 831.0 L358.4 831.0 L362.4 831.0 L366.4 831.0 L370.4 831.0 L374.4 831.0 L378.4 831.0 L382.4 831.0 L386.4 831.0 L390.4 831.0 L394.4 831.0 L398.4 831.0 L402.4 831.0 L406.4 831.0 L410.4 831.0 L414.4 831.0 L418.4 831.0 L422.4 831.0 L426.4 831.0 L430.4 831.0 L434.4 831.0 L438.4 831.0 L442.4 831.0 L446.4 831.0 L450.4 831.0 L454.4 831.0 L458.4 831.0 L462.4 830.7 L466.2 829.4 L469.1 826.7 L470.8 823.1 L471.6 819.2 L472.4 815.3 L473.0 811.3 L473.9 807.4 L474.8 803.5 L475.5 799.6 L476.2 795.6 L476.7 791.7 L477.3 787.7 L477.7 783.7 L478.5 779.8 L478.9 775.8 L479.5 771.9 L480.0 767.9 L480.6 764.0 L481.1 760.0 L481.6 756.0 L482.2 752.1 L482.7 748.1 L483.2 744.2 L483.6 740.2 L484.1 736.2 L484.5 732.2 L485.1 728.3 L485.5 724.3 L486.0 720.3 L486.4 716.4 L486.8 712.4 L487.4 708.4 L487.8 704.4 L488.0 700.5 L488.0 696.5 L488.0 692.5 L487.7 688.5 L486.0 684.9 L483.0 682.3 L479.2 681.1 L475.2 681.0 L471.2 681.0 L467.2 681.0 L463.2 681.0 L459.2 681.0 L455.2 681.0 L451.2 681.0 L447.2 681.0 L443.2 681.0 L439.2 681.0 L435.2 681.0 L431.2 681.0 L427.2 681.0 L423.2 681.0 L419.2 681.0 L415.2 681.0 L411.2 681.0 L407.2 681.0 L403.2 681.0 L399.2 681.0 L395.2 681.0 L391.2 681.0 L387.2 681.0 L383.2 681.0 L379.2 681.0 L375.2 681.0 L371.2 681.0 L367.2 681.0 L363.2 681.0 L359.2 681.0 L355.2 681.0 L351.2 681.0 L347.2 681.0 L343.2 681.0 L339.2 681.0 L335.2 681.0 L331.2 681.0 L327.2 681.0 L323.2 681.0 L319.2 681.0 L315.2 681.0 L311.2 681.0 L307.2 681.0 L303.2 681.0 L299.2 681.0 L295.2 681.0 L291.2 681.0 L287.2 681.0 L283.2 681.0 L279.2 681.0 L275.2 681.0 L271.2 681.0 L267.2 681.0 L263.2 681.0 L259.2 681.0 L255.2 681.0 L251.2 681.0 L247.2 681.0 L243.2 681.0 L239.2 681.0 L235.2 681.0 L231.2 681.0 L227.2 681.0 L223.2 681.0 L219.2 681.0 L215.2 681.0 L211.2 681.0 L207.2 681.0 L203.3 681.2Z' },
    // fallback when button is removed: rounded rect, fractions of the image (centre x / y, w / h, r of width)
    hotspot: { x: 0.5047, y: 0.6105, w: 0.495, h: 0.108, r: 0.022 },
    glow: '255, 46, 46',               // pulse / glow colour (r, g, b)
    pulsePeriod: 3.2,                  // s: glow breathing
    tracerPeriod: 4.8,                 // s: one lap of the light tracer along the outline (0 = off)
    float: 1.5,                        // px: idle float amplitude (0 = off)
    caption: 'Press to start',
    enterMs: 2400, exitMs: 900,        // entrance (rim-light sweep, push-in, tilt settle, blur-in); exit push-in + blur-out
    introOffset: 0.30,                 // s: the intro clock starts this far in at the press (its unlock flash, t = 0.60, lands on the chirp)
    chirpGain: 0.55,                   // key click + lock chirp level (synthesised, follows the mute button)
    skipParams: ['nofob', 't', 't1', 't1play', 'loopt', 't1hold']   // debug / preview URLs skip the fob
  },

  audio: {
    file: 'assets/audio/engine_v8.mp3',   // official AMG start recording only (starter, catch, 3 blips, decay) + real V8 idle (tools/make_audio_v8.py)
    meta: 'assets/audio/engine_v8.json', // loop points / blips + RMS envelope (50 Hz) + fx_env / fx_hit (100 Hz) for the FX
    engineHitInClip: 0.33,      // ignition (catch) in the clip; the recording's own starter precedes it
    emblemHitInClip: 1.59,     // next distinct engine hit
    lateJoinWindow: 0.5,        // audio unlocked up to 0.5 s after ignition -> join the start clip at the matching offset
    joinFade: 0.03,             // fade-in when joining the start clip mid-way
    idleJoinFade: 0.6,          // later than that -> start straight in the idle loop, faded in
    idleFadeOnScroll: 1.5       // idle fades out when the user starts scrolling
  },

  timeline: {
    fadeInFromBlack: 0.55,
    unlockFlash: 0.60,          // single amber flash
    doubleFlash: 1.30,          // 2nd flash at +amber.doubleGap (1.54); red bloom starts on the 2nd
    engineStart: 2.90           // ignition (audio clip starts 0.33 s earlier, at 2.57: the AMG recording's own starter)
    // emblem = engineStart + (emblemHitInClip - engineHitInClip) = 4.16 (derived in intro.js)
  },

  intro: { hazeAlpha: 0.04, hazeRed: -0.5, glintAlpha: 0.10 },   // v9: haze 0.10 -> 0.04 and fading (not growing) in the red room

  amber: { rise: 0.04, hold: 0.16, decay: 0.14, doubleGap: 0.24, level: 1.0 },

  red: { bloomDuration: 0.9 },

  engineStart: {
    shakeDuration: 0.15, shakePx: 2.5,      // scene px (1672 wide)
    drlMain: 0.30, drlFeather: 18,          // main DRL bar wipes inner -> outer
    drlElemDelay: 0.18, drlElemFade: 0.12,  // upper + lower DRL segments light as whole elements
    ledDelay: 0.05, ledTrace: 0.55,         // grille-surround LED (open trace, top + sides, no bottom edge): traced from both lower tips up to the top centre
    ledLevel: 1.0, ledHead: 0.9, ledFlash: 0.35, ledFlashDur: 0.35,
    slatDelay: 0.10, slatStagger: 0.04, slatFade: 0.15,    // 8 bars (4 + 4), centre-out
    frameFade: 0.45,
    starGap: 0.06, starFade: 0.18, starPulse: 0.55, starPulseGain: 0.6
  },

  emblem: {                             // v6 entrance, all locked to the engine hit (H.emblem)
    preGlow: 0.22, preGlowLead: 0.35,     // back-glow starts building just before the hit (anticipation)
    hitFlash: 0.45, hitFlashDur: 0.75,    // glow swell from behind on the hit
    rimIn: 0.30, faceDelay: 0.12, faceDuration: 1.10,
    scaleFrom: 1.055, settle: 4.2,        // depth settle: comes in slightly large, settles to 1 (damped, tiny undershoot)
    haloDelay: 0.10, haloDuration: 1.6, rimOutDuration: 0.9,
    sweepDelay: 0.62, sweepDuration: 0.95, sweepWidth: 0.16, sweepFace: 0.85, sweepRim: 1.25   // light sweep across the metal
  },

  cover: { sheen: 0.85 },                 // v6: red light on the cover (fold highlights + wall rim light + floor bounce)

  blips: { light: 0.12, shakePx: 0.9, shakeDuration: 0.22 },   // v6: lights / camera react to the 3 throttle blips (from audio meta)

  fx: {                                   // v7: driven by fx_env / fx_hit from the audio JSON (catch + blips)
    shakeHit: 2.6, rumble: 0.55, zoomPunch: 0.006,   // scene px / scale; off under reduced motion
    lightEnv: 0.18, lightHit: 0.30,       // LED / DRL / slats / star / grille gain surge
    redEnv: 0.10, redHit: 0.16,           // red ambient pulse (wall, floor, cover sheen)
    bloom: 0.10, bloomEnv: 0.03, vignette: 0.22, floorFlicker: 0.5
  },

  scrollCue: { powerOn: 1.0, period: 1.8, dots: 10 },          // v6: LED cue; text pulse phase-locked to the line run

  loop: {
    breathStartAfterEmblem: 1.6, breathRamp: 2.0, breathAmount: 0.06, breathPeriod: 4.0,
    engineGlow: 0.10,          // red room gain follows the engine / idle envelope (+-), 0 to disable
    scrollCueAt: 9.0, hudAt: 0.4, soundHintAt: 0.3
  },

  render: {
    grain: 0.05,               // film-grain dither (kills banding in dark gradients); 0 to disable
    maxBackingPx: 4096,        // cap for canvas width/height in device pixels
    cacheSmoothing: 'high',    // one-time resample of every layer to its on-screen size (per resize)
    frameSmoothing: 'medium'   // v9: at rest every layer is an integer 1:1 blit of the cache; only the brief zoom punch / emblem settle resample
  },

  assets: {
    sets: { hd: { dir: 'assets/layers/hd/', scale: 2.5 }, sd: { dir: 'assets/layers/sd/', scale: 1.5 } }
  },

  framing: {
    safeRegion: [440, 60, 1230, 900],   // scene px that must stay visible (car + emblem)
    focus: [834, 520],
    maxDpr: 3
  }
};
