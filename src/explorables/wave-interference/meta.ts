import type { ExplorableMeta } from '../../engine/meta';

export const meta: ExplorableMeta = {
  slug: 'wave-interference',
  title: 'Two sources, and the darkness between them',
  domain: 'physics',
  blurb:
    'Add one wave to another and you can get nothing at all. The quiet lines are not places the ' +
    'waves fail to reach — they are places both arrive, and cancel.',
  minutes: 6,
  prerequisites: [],
  related: [],
  equation: 'I = 4\\cos^{2}\\!\\left(\\frac{k\\,\\Delta r - \\varphi}{2}\\right)',
  updated: '2026-08-19',

  hook: [
    'Two loudspeakers playing the identical tone. Walk slowly across the room in front of them ' +
      'and the sound does not fade smoothly — it drops to near silence at particular spots, ' +
      'comes back to full volume, and drops again.',
    'Turning one speaker off makes those silent spots louder. Adding a second source of sound ' +
      'has made some places quieter than one source alone, which is not how anything else you ' +
      'add together behaves.',
  ],

  play: 'Drag the separation. Count the pale cancellation lines as they appear and sweep outward.',

  reveal: [
    'A note on the picture before the mechanism: strength runs pale to blue, so the lines where ' +
      'the waves cancel are the *pale* ones. In optics these are called dark bands, because ' +
      'there the cancelling waves are light; with loudspeakers they are simply the quiet spots.',
    'The two waves arrive at every point having travelled different distances. That difference ' +
      'in path length, measured in wavelengths, is the entire story. Where it is a whole number ' +
      'of wavelengths the crests line up and you get double amplitude. Where it is a half-integer ' +
      'the crest of one lands on the trough of the other and they annihilate exactly.',
    'Notice what the formula depends on: only the path difference. Not the distance from the ' +
      'sources, not the direction as such. Every point sharing a path difference behaves ' +
      'identically, and the set of points with a fixed path difference between two fixed points ' +
      'is a hyperbola. That is why the pattern is a family of hyperbolic bands rather than ' +
      'anything more complicated, and why far from the sources they straighten into rays.',
    'The path difference can never exceed the separation, which is what makes the number of ' +
      'cancellation bands finite and countable. Push the sources closer than half a wavelength and there is ' +
      'no direction in which they can be a half-wavelength out of step, so the cancellation bands ' +
      'vanish entirely. Pull them apart and new bands appear on the axis and migrate outward, one for ' +
      'every additional half-wavelength of separation.',
    'Only the ratio of separation to wavelength matters. Doubling both changes nothing about the ' +
      'pattern — a fact that lets the same arithmetic describe loudspeakers metres apart, light ' +
      'through slits a hair\'s width apart, and radio telescopes on different continents.',
  ],

  edges: [
    {
      prompt:
        'Bring the sources closer than half a wavelength. Where did the cancellation lines go, and ' +
        'why must they go?',
      answer:
        'They cease to exist. Cancellation needs the two paths to differ by half a wavelength, ' +
        'and the path difference can never exceed the separation itself. Once the separation is ' +
        'below half a wavelength there is nowhere in the plane where the condition can be met, ' +
        'so the field is bright everywhere — brighter in some directions than others, but never ' +
        'dark.',
      settings: { separation: 0.04, wavelength: 0.3, mode: 'intensity' },
    },
    {
      prompt:
        'Set the phase offset to exactly π. What happens straight ahead, and what does that do ' +
        'to the rest of the pattern?',
      answer:
        'The central band goes from brightest to completely dark. On the perpendicular bisector ' +
        'the paths are equal, so with the sources driven half a turn apart the waves arrive ' +
        'exactly opposed. The whole family slides by half a fringe: the quiet lines now sit at ' +
        'whole multiples of the wavelength rather than half-multiples. Nothing about the ' +
        'geometry changed — only when the sources are pushed.',
      settings: { phase: 3.14, separation: 0.5, wavelength: 0.12 },
    },
    {
      prompt:
        'Double the separation and the wavelength together. Predict what the pattern does before ' +
        'you look.',
      answer:
        'Nothing. The pattern depends only on the ratio of the two, so scaling both leaves the ' +
        'number of bands and their angles identical. This is why the same equation covers sound, ' +
        'light and radio without change — only the ratio is physical.',
      settings: { separation: 1, wavelength: 0.24 },
    },
    {
      prompt:
        'Switch to the live wave and watch one of the pale lines. Are the waves absent there?',
      answer:
        'No — and this is the point the time-averaged view hides. Both waves are passing through ' +
        'that line the whole time, at full strength. They are simply always opposed there, so ' +
        'the sum stays at zero while the two parts are large. Energy is not destroyed; it is ' +
        'redistributed into the bright bands, which is why those are four times the intensity of ' +
        'one source rather than twice.',
      settings: { mode: 'amplitude', separation: 0.5, wavelength: 0.12 },
    },
  ],

  limits: [
    'These are ideal point sources of a single pure frequency, radiating forever with no decay ' +
      'of amplitude with distance. Real waves spread their energy over a growing wavefront, so ' +
      'amplitude falls with distance and the cancellation away from the midline is never quite ' +
      'total. Dropping that decay keeps the geometry clean at the cost of making the cancellation ' +
      'cleaner than any real pair of sources achieves.',
    'The two sources are perfectly coherent: locked in frequency with a fixed phase relationship ' +
      'that never drifts. Ordinary light from two separate lamps is not, which is why you cannot ' +
      'see interference from two bulbs and why the classic experiment splits one beam in two ' +
      'rather than using two sources.',
    'A single wavelength is being drawn. White light, or any real sound, is a mixture, and each ' +
      'component produces its own pattern at its own scale. Superposing those washes the fringes ' +
      'out away from the centre, which is why the coloured edges in a real diffraction pattern ' +
      'fade into uniformity rather than continuing forever.',
    'This is a scalar field: one number per point. Real electromagnetic waves are vectors with a ' +
      'polarisation, and two waves polarised at right angles do not interfere at all no matter ' +
      'how their paths differ. Sound escapes this complication by genuinely being scalar.',
    'The sources are drawn as points, and the field is computed on a finite grid. Near the ' +
      'sources the true field diverges and the grid cannot resolve the fringe spacing at the ' +
      'largest separations — the moiré you can provoke there is an artefact of sampling, not ' +
      'something the physics does.',
  ],
};
