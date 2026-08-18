import type { ExplorableMeta } from '../../engine/meta';

export const meta: ExplorableMeta = {
  slug: 'simpsons-paradox',
  title: 'When the average reverses every group',
  domain: 'statistics',
  blurb:
    'A trend can point one way in every subgroup of your data and the opposite way in the ' +
    'data as a whole. Both numbers are correct. Only one of them answers your question.',
  minutes: 6,
  prerequisites: [],
  related: ['statistical-power'],
  equation:
    '\\text{pooled} = \\frac{\\beta_w s_x^2 + \\text{sep}\\cdot\\text{shift}\\cdot v_g}' +
    '{s_x^2 + \\text{sep}^2 v_g}',
  updated: '2026-08-18',

  hook: [
    'In 1973 the University of California, Berkeley looked at its graduate admissions and found ' +
      'that men were admitted at a noticeably higher rate than women. The aggregate number was ' +
      'not in dispute.',
    'Broken down by department, the picture inverted: in most departments women were admitted at ' +
      'the same rate or higher. Women had applied in greater numbers to the departments that ' +
      'admitted the fewest people of any gender. Neither figure was a mistake, and averaging the ' +
      'departments together is what produced the reversal.',
  ],

  play: 'Slide the groups apart. Watch the single fitted line swing against every group in it.',

  reveal: [
    'A least-squares slope is a covariance divided by a variance, and when the data comes in ' +
      'groups both quantities split into two pieces: what varies inside groups, and what varies ' +
      'between them. The pooled slope is a weighted blend of the within-group trend and the ' +
      'trend traced by the group centres, weighted by how much of the horizontal spread each one ' +
      'contributes.',
    'That is the whole mechanism. When the group centres march downward while the points inside ' +
      'each group march upward, the two terms fight, and whichever has more horizontal spread ' +
      'behind it wins. Pull the groups apart and the between-group term takes over; push them ' +
      'together and the within-group term does. The reversal is not a statistical anomaly, and ' +
      'it does not require a large sample or an unlucky draw. It is arithmetic.',
    'The behaviour with separation is worth watching closely, because the obvious guess is ' +
      'wrong. Widening the gap does not keep making the reversal more dramatic. The pooled slope ' +
      'falls, bottoms out, and then drifts back toward flat, because separation adds to the ' +
      'denominator faster than it adds to the numerator. Very widely separated groups produce a ' +
      'reversed but weak pooled trend.',
    'The part statistics cannot settle for you is which number to report. Nothing in the data ' +
      'says whether the grouping is a confounder you should adjust for or a step on the causal ' +
      'path you would be wrong to remove. At Berkeley, department was plainly a mediator — where ' +
      'you apply determines your odds — so the within-department figures were the meaningful ' +
      'ones. Change the story so the grouping is a consequence of the exposure rather than a ' +
      'cause, and the pooled number becomes the right one instead. The paradox is resolved by ' +
      'knowing what generated the data, not by computing more carefully.',
  ],

  edges: [
    {
      prompt:
        'Set the separation to zero so the groups sit on top of each other. Can a reversal ' +
        'survive that? Why not?',
      answer:
        'It cannot. With no horizontal separation the group centres carry no spread in x, so the ' +
        'between-group term drops out of both the numerator and the denominator and the pooled ' +
        'slope is just the within-group slope. A reversal needs the groups to differ in x — ' +
        'that is what gives the between-group trend any leverage.',
      settings: { separation: 0, shift: -2.2, within: 1 },
    },
    {
      prompt:
        'Now put the separation back and set the vertical offset to zero instead. The reversal ' +
        'disappears again — but something else has happened to the pooled line. What?',
      answer:
        'It has flattened. With no offset there is no between-group covariance to fight the ' +
        'within-group trend, but the between-group spread is still sitting in the denominator, ' +
        'so the pooled slope is pulled toward zero without changing sign. That is ordinary ' +
        'aggregation attenuation, and Simpson\\u2019s paradox is just the case where it overshoots ' +
        'past zero.',
      settings: { separation: 2, shift: 0, within: 1 },
    },
    {
      prompt:
        'With the default offset and trend, hunt for the separation that produces the steepest ' +
        'reversal. Is it the largest one available?',
      answer:
        'No — it is around 0.9, where the pooled slope reaches about -1.42. Beyond that the ' +
        'reversal weakens steadily: at separation 4 it is roughly -0.5, and it keeps easing ' +
        'toward flat. Separation enters the denominator squared and the numerator only linearly, ' +
        'so past the optimum it dilutes the very effect it created.',
      settings: { separation: 0.9, shift: -2.2, within: 1, noise: 0.2 },
    },
    {
      prompt:
        'Make the vertical offset positive so the groups climb as they move right. What happens, ' +
        'and what does that tell you about when aggregation is safe?',
      answer:
        'Both slopes point the same way and the pooled line is steeper than any group. ' +
        'Aggregation is safe precisely when the between-group trend agrees with the within-group ' +
        'trend — which is a claim about how the data came about, not something the numbers can ' +
        'confirm on their own. You have to know why the groups differ.',
      settings: { separation: 2, shift: 1.5, within: 1 },
    },
  ],

  limits: [
    'This is the continuous, regression form of the paradox. The Berkeley case in the opening is ' +
      'the categorical form, about rates in a contingency table, where the arithmetic is ' +
      'weighted averages of proportions rather than covariances. The mechanism is the same and ' +
      'the formulas are not, so do not read the slope algebra here as covering that case.',
    'Groups are balanced, equally spaced, equally sized, with the same trend and the same ' +
      'horizontal spread in each. Real subgroups differ in all of those, and unequal group sizes ' +
      'in particular change the weighting substantially. The exact closed form here holds only ' +
      'for this tidy design; the qualitative behaviour is general.',
    'Everything is linear, and only one grouping variable exists. With several grouping ' +
      'variables the reversal can appear and disappear as you condition on different subsets, ' +
      'and there is no guarantee that adding more controls moves you closer to the truth.',
    'Most importantly: this model cannot tell you which slope to believe, and neither can any ' +
      'amount of data. That choice rests on a causal claim about whether the grouping is a ' +
      'confounder, a mediator, or a collider. Conditioning on a collider manufactures ' +
      'associations that are not there, so "always look within subgroups" is as wrong a rule as ' +
      '"always pool".',
  ],
};
