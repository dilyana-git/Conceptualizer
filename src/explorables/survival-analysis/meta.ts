import type { ExplorableMeta } from '../../engine/meta';

export const meta: ExplorableMeta = {
  slug: 'survival-analysis',
  title: 'The people who have not died yet',
  domain: 'statistics',
  blurb:
    'Half your data is unfinished: the subject was still alive, the customer had not yet ' +
    'cancelled, the machine had not yet failed. Throwing those rows away is the intuitive ' +
    'move, and it is badly wrong.',
  minutes: 7,
  prerequisites: [],
  related: [],
  equation: '\\hat{S}(t) = \\prod_{t_j \\le t} \\left(1 - \\frac{d_j}{n_j}\\right)',
  updated: '2026-08-18',

  hook: [
    'A subscription business wants to know how long a customer lasts. It takes everyone who ' +
      'has cancelled, averages how long they stayed, and reports the answer. The number comes ' +
      'out at seven months.',
    'Every customer who has not cancelled — including every one of the best ones, who have been ' +
      'paying for years and show no sign of stopping — contributed nothing to that average. ' +
      'They were dropped for having incomplete data. The incompleteness was the good news.',
  ],

  play:
    'Raise the censored share. Watch the naive curves peel away from the truth while ' +
    'Kaplan-Meier stays on it.',

  reveal: [
    'An observation is censored when you know the subject survived up to some time and know ' +
      'nothing after that. It is not missing data. It is a genuine, informative observation — ' +
      '"this one lasted at least eleven months" — that simply does not have a number attached ' +
      'to the end of it.',
    'The Kaplan-Meier estimator uses exactly that much information and no more. It walks ' +
      'forward through time and, at each moment when someone actually has the event, asks a ' +
      'narrow question: of the people still under observation right now, what fraction just ' +
      'failed? Survival is the running product of the complements. A censored subject counts ' +
      'in the denominator for every moment they were genuinely at risk, and then quietly leaves ' +
      'the risk set without ever counting as a failure.',
    'That is why the estimator is a step function that only drops at observed events, and why ' +
      'its steps get taller as the study goes on — later steps are computed from a smaller risk ' +
      'set, so each individual failure moves the curve further. The confidence band widens for ' +
      'the same reason, and by the far right of the plot it is often too wide to support any ' +
      'claim at all.',
    'The two naive alternatives fail in opposite directions, and it is worth seeing both. ' +
      'Discarding censored subjects keeps only the people who failed early enough to be seen ' +
      'failing, so the curve collapses. Counting them as permanent survivors credits them with ' +
      'immortality, so the curve flattens out at the censored share and never reaches zero. ' +
      'Neither is a conservative choice you could defend as erring on the safe side.',
  ],

  edges: [
    {
      prompt:
        'Set the censored share to zero. What happens to the three curves, and why must it ' +
        'happen?',
      answer:
        'They land exactly on top of each other. With nothing censored there is no disagreement ' +
        'to have: every subject has a known event time, so Kaplan-Meier reduces to one minus the ' +
        'empirical distribution function, which is what both naive methods compute too. All the ' +
        'difference between these estimators is difference in how they handle censoring.',
      settings: { censoring: 0, comparator: 'drop' },
    },
    {
      prompt:
        'With 60% censored, discard the censored subjects. The estimated median lands near 4.8 ' +
        'months against a true 12. Where does that number come from?',
      answer:
        'Keeping only subjects who failed before they were censored does not sample survival ' +
        'times — it samples the minimum of the failure time and the censoring time. For ' +
        'exponential data that minimum has the two rates added together, so the curve decays at ' +
        '1/(1-c) times the true rate and the median comes out at median x (1-c). At c = 0.6 ' +
        'that is 12 x 0.4 = 4.8 months. The bias is not noise, and no amount of extra data ' +
        'removes it.',
      settings: { censoring: 0.6, comparator: 'drop', median: 12 },
    },
    {
      prompt:
        'Now treat the censored subjects as survivors instead, still at 60% censored. Why does ' +
        'the median come back as "not reached"?',
      answer:
        'That method can never push the curve below the censored share, because those subjects ' +
        'are counted as alive forever. With 60% censored the curve bottoms out around 0.6 and ' +
        'so never crosses 0.5. The honest reading is not that survival is excellent — it is that ' +
        'this estimator is incapable of answering the question you asked it.',
      settings: { censoring: 0.6, comparator: 'ignore', median: 12 },
    },
    {
      prompt:
        'Drop the cohort to 20 and turn on the confidence band. Is the curve at the far right ' +
        'still telling you anything?',
      answer:
        'Almost nothing. By then only a handful of subjects remain at risk, so each event moves ' +
        'the estimate enormously and the band spans most of the vertical axis. The tail of a ' +
        'Kaplan-Meier curve is the part most often quoted and least often supported; the risk ' +
        'set behind it, not the smoothness of the line, is what decides whether it means ' +
        'anything.',
      settings: { n: 20, show_ci: true, comparator: 'none' },
    },
  ],

  limits: [
    'The survival times here are exponential, which means the hazard is constant: a subject ' +
      'who has already lasted a year is exactly as likely to fail next month as one who joined ' +
      'yesterday. Almost nothing real behaves that way. Machines wear out, post-surgical risk ' +
      'falls with time, and customer churn is usually front-loaded. Kaplan-Meier itself assumes ' +
      'no such shape — that simplification is in the simulated data, not in the estimator.',
    'Censoring here is independent of survival, and that assumption is doing enormous work. If ' +
      'subjects drop out precisely because they are about to fail — patients too ill to attend, ' +
      'customers who stop using a service before formally cancelling — then censoring is ' +
      'informative and Kaplan-Meier is biased along with everything else. Nothing in the data ' +
      'reveals this; it has to be argued from how the data was collected.',
    'The confidence band is the plain Greenwood interval, clamped to [0, 1]. Statistical ' +
      'software usually defaults to a complementary log-log transform instead, which behaves ' +
      'better near zero and one. The limits are also pointwise: each vertical slice is a 95% ' +
      'interval for that instant, and reading the pair of curves as a band containing the whole ' +
      'true curve with 95% probability overstates what they say.',
    'There are no covariates. This estimator describes one homogeneous group and cannot say ' +
      'whether treatment beat control, or which customers churn faster, once anything else ' +
      'differs between subjects. That question is where proportional hazards and the Cox model ' +
      'begin, and they bring assumptions of their own.',
    'Every subject enters at time zero. Real cohorts have staggered entry, competing risks that ' +
      'remove subjects for reasons that are not the event of interest, and subjects who return ' +
      'after leaving. Each of those needs machinery beyond what is drawn here.',
  ],
};
