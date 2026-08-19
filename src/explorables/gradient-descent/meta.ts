import type { ExplorableMeta } from '../../engine/meta';

export const meta: ExplorableMeta = {
  slug: 'gradient-descent',
  title: 'Rolling downhill, badly',
  domain: 'statistics',
  blurb:
    'Almost every model you have ever trained was fitted by repeatedly stepping downhill. The ' +
    'step size is the one number that decides whether that works, and the surface decides what ' +
    'counts as too big.',
  minutes: 7,
  prerequisites: [],
  related: ['bias-variance'],
  equation: '\\theta_{t+1} = \\theta_t - \\eta \\, \\nabla f(\\theta_t)',
  updated: '2026-08-18',

  hook: [
    'The advice you get about learning rates is that too small is slow and too large is ' +
      'unstable, so you should pick something in the middle. That makes it sound like a dial ' +
      'with a comfortable range.',
    'It is not a dial with a range. On a quadratic there is an exact threshold, and one step ' +
      'past it the loss does not degrade gracefully — it grows without bound, faster every ' +
      'iteration. Drag the learning rate up on the round bowl and you can find the edge to two ' +
      'decimal places.',
  ],

  play: 'Raise the learning rate until the path stops converging. Note where that happens.',

  reveal: [
    'On a quadratic, one step of gradient descent multiplies your distance from the minimum by ' +
      'a fixed number: one minus twice the curvature times the learning rate. Everything follows ' +
      'from that single factor. If its magnitude is below one the distance shrinks geometrically ' +
      'and you converge. If it is above one the distance grows geometrically and you are gone. ' +
      'The boundary sits exactly at a learning rate of one over the curvature, and at that rate ' +
      'the factor is exactly minus one — the iterate flips from side to side forever without ' +
      'ever getting closer.',
    'In more than one dimension every direction has its own curvature and its own factor, and ' +
      'they must all be stable at once. So the most curved direction sets the largest step you ' +
      'are allowed to take. The least curved direction sets how fast you actually make progress. ' +
      'When those two are far apart — the ravine here has a ratio of forty — you are forced to ' +
      'take tiny steps because of one direction while crawling along another. That ratio is the ' +
      'condition number, and it, not the learning rate, is what makes some problems hard.',
    'Momentum attacks exactly this. Carrying a fraction of the previous step forward means the ' +
      'oscillations across the narrow direction cancel out between consecutive steps, while the ' +
      'consistent pull along the flat direction accumulates. The same learning rate that crawls ' +
      'without momentum can cross the ravine in a fraction of the iterations with it, which is ' +
      'why essentially no one runs plain gradient descent any more.',
    'None of this guarantees you find the best minimum, only a minimum. On a surface with more ' +
      'than one valley, plain descent goes to whichever one you happened to start in — the ' +
      'algorithm has no way of knowing another exists. Momentum can carry you over a ridge into ' +
      'a different valley, which is sometimes a rescue and sometimes just a different arbitrary ' +
      'answer.',
  ],

  edges: [
    {
      prompt:
        'On the round bowl, find the learning rate where the path stops shrinking but does not ' +
        'blow up either. What is happening at that exact value?',
      answer:
        'At 1.00 the multiplier is exactly minus one. Each step lands the same distance from the ' +
        'minimum on the opposite side, forever — the path is a fixed oscillation that neither ' +
        'converges nor diverges. The bowl has curvature 1, so the threshold is 1/1. Below it you ' +
        'converge, above it you diverge, and there is no soft landing on either side.',
      settings: { surface: 'bowl', learningRate: 1, momentum: 0, steps: 40 },
    },
    {
      prompt:
        'Switch to the ravine, keeping momentum at zero. Try to reach the minimum in 60 steps ' +
        'with any learning rate. Why can you not?',
      answer:
        'Because the two directions want incompatible step sizes. Anything above 0.5 blows up in ' +
        'the steep direction, and 0.5 is far too small to make progress along the flat one — its ' +
        'curvature is forty times lower, so it needs roughly forty times as many iterations. No ' +
        'single learning rate serves both. This is what an ill-conditioned problem feels like ' +
        'from the inside.',
      settings: { surface: 'ravine', learningRate: 0.45, momentum: 0, steps: 60 },
    },
    {
      prompt:
        'Now add momentum on the ravine, leaving everything else alone. How much does it buy you?',
      answer:
        'At 0.9 it reaches a loss more than ten times lower in the same 60 steps. The steps ' +
        'across the narrow direction alternate in sign and largely cancel, while the steps along ' +
        'the flat direction all point the same way and accumulate. Momentum is not a general ' +
        'speed-up — it is specifically a fix for bad conditioning.',
      settings: { surface: 'ravine', learningRate: 0.45, momentum: 0.9, steps: 60 },
    },
    {
      prompt:
        'On two valleys, sweep the starting angle from 0 to 180 with momentum at zero. Where ' +
        'does the answer change, and what does that tell you about the loss you end on?',
      answer:
        'It flips somewhere near 90 degrees, where the starting point crosses the ridge. Both ' +
        'valleys are equally deep here, so it does not matter which you get — but nothing in the ' +
        'algorithm knew there was a choice. Turn momentum up to 0.95 and the path can be thrown ' +
        'over the ridge entirely, which means your answer now depends on the step size as well ' +
        'as the starting point.',
      settings: { surface: 'double', learningRate: 0.05, momentum: 0, startAngle: 80 },
    },
  ],

  limits: [
    'These surfaces are two-dimensional and drawn from closed-form formulas. A real network has ' +
      'millions of parameters, and the geometry up there is not a bowl with a bottom — it is ' +
      'dominated by saddle points and long flat valleys rather than the isolated local minima ' +
      'that two dimensions make so vivid. The intuition about step size and curvature transfers; ' +
      'the mental picture of a landscape with a few distinct pits does not.',
    'The gradient here is exact. Real training uses a gradient estimated from a minibatch, which ' +
      'is noisy, and that noise is not merely a nuisance — it changes the dynamics, helps escape ' +
      'saddles, and makes the stability threshold itself a fuzzy region rather than a sharp line.',
    'The learning rate is constant. Nearly every practical optimiser varies it: warmup, decay ' +
      'schedules, and per-parameter scaling in the Adam family, which effectively rescales the ' +
      'curvature in each direction and so attacks the conditioning problem more directly than ' +
      'momentum alone.',
    'Convergence is judged by the loss on the surface being optimised. In modelling, that is ' +
      'training loss, and driving it to zero is not the goal — it is how you overfit. What the ' +
      'optimiser is good at and what you actually want come apart, which is the subject of the ' +
      'bias-variance explorable rather than this one.',
  ],
};
