const GRADE_ORDER = [
  "AAA",
  "AA+",
  "AA",
  "AA-",
  "A+",
  "A",
  "A-",
  "BBB+",
  "BBB",
  "BBB-",
  "BB+",
  "BB",
  "BB-",
  "B+",
  "B",
  "B-",
  "CCC",
  "CC",
  "C",
  "D"
];

function getGradeRank(grade) {
  const index = GRADE_ORDER.indexOf(grade);
  return index === -1 ? GRADE_ORDER.length - 1 : index;
}

function isDowngrade(previousGrade, nextGrade) {
  return getGradeRank(nextGrade) > getGradeRank(previousGrade);
}

module.exports = {
  GRADE_ORDER,
  getGradeRank,
  isDowngrade
};
