/* ============================================
   TurboRush — Track Definitions
   ============================================ */

const TRACKS = [
  {
    id: 0,
    name: 'Neon City Circuit',
    thumbnail: '🏙️',
    description: 'Blaze through a futuristic downtown with towering skyscrapers and neon-lit streets.',
    laps: 3,
    length: '4.2 km',
    environment: 'city',
    skyColor: 0x0a0a1a,
    groundColor: 0x1a1a2e,
    roadColor: 0x2a2a3a,
    accentColor: 0x00d4ff,
    buildingDensity: 0.8
  },
  {
    id: 1,
    name: 'Sunset Valley',
    thumbnail: '🌄',
    description: 'Wind through golden countryside hills under a breathtaking sunset sky.',
    laps: 3,
    length: '5.1 km',
    environment: 'countryside',
    skyColor: 0xff6b35,
    groundColor: 0x2d5016,
    roadColor: 0x3a3a3a,
    accentColor: 0xffa500,
    buildingDensity: 0.1
  },
  {
    id: 2,
    name: 'Midnight Coast',
    thumbnail: '🌊',
    description: 'Race along a moonlit coastal highway with crashing waves and starry skies.',
    laps: 3,
    length: '3.8 km',
    environment: 'coastal',
    skyColor: 0x0b0b2e,
    groundColor: 0x1a3a2a,
    roadColor: 0x2a2a2a,
    accentColor: 0xa855f7,
    buildingDensity: 0.2
  },
  {
    id: 3,
    name: 'Thunder Pass',
    thumbnail: '⛰️',
    description: 'Conquer treacherous mountain roads with hairpin turns and dramatic elevation.',
    laps: 3,
    length: '6.0 km',
    environment: 'mountain',
    skyColor: 0x1a1a2e,
    groundColor: 0x3a3a3a,
    roadColor: 0x333333,
    accentColor: 0xff4655,
    buildingDensity: 0.05
  }
];

// Track waypoint generation (creates a closed-loop circuit)
function generateTrackWaypoints(trackId) {
  const presets = {
    0: { radius: 200, segments: 60, variation: 40 },  // city — tight turns
    1: { radius: 280, segments: 50, variation: 70 },  // countryside — sweeping curves
    2: { radius: 240, segments: 55, variation: 50 },  // coastal — flowing bends
    3: { radius: 260, segments: 45, variation: 90 }   // mountain — dramatic curves
  };

  const p = presets[trackId] || presets[0];
  const waypoints = [];
  const seed = trackId * 1000 + 42;

  for (let i = 0; i < p.segments; i++) {
    const angle = (i / p.segments) * Math.PI * 2;
    const noise1 = Math.sin(angle * 3 + seed) * p.variation;
    const noise2 = Math.cos(angle * 5 + seed * 0.7) * p.variation * 0.5;
    const r = p.radius + noise1 + noise2;

    waypoints.push({
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      y: trackId === 3 ? Math.sin(angle * 2) * 15 : 0 // elevation for mountain
    });
  }

  return waypoints;
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TRACKS, generateTrackWaypoints };
}
