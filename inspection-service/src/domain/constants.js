// Condition ratings used by OMS inspectors (1 = worst, 5 = best)
const CONDITION_RATINGS = {
  1: 'Critical',
  2: 'Poor',
  3: 'Fair',
  4: 'Satisfactory',
  5: 'Good',
};

const SEVERITIES = ['minor', 'moderate', 'major', 'critical'];

// Allowed moves in the inspection review workflow
const STATUS_TRANSITIONS = {
  draft: ['submitted'],
  submitted: ['approved', 'draft'], // engineer can approve or send back
  approved: [],                     // approved records are locked
};

module.exports = { CONDITION_RATINGS, SEVERITIES, STATUS_TRANSITIONS };
