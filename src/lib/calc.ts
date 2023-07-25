import EloRank from 'elo-rank';

// IF YOU CHANGE THIS ARG YOU SHOULD RECALCULATE ALL ELOS
const elo = new EloRank(40);

export const calculateNewElo = ({
	winner,
	loser
}: {
	winner: number;
	loser: number;
}): { winner: number; loser: number } => {
	const expectedScoreWinner = elo.getExpected(winner, loser);
	const expectedScoreLoser = elo.getExpected(loser, winner);
	return {
		winner: elo.updateRating(expectedScoreWinner, 1, winner),
		loser: elo.updateRating(expectedScoreLoser, 0, loser)
	};
};

export const calculateNewStreak = (gameResult: -1 | 1, existingStreak: number = 0) => {
	if (gameResult === 1) {
		return existingStreak > 0 ? existingStreak + 1 : 1;
	} else {
		return existingStreak < 0 ? existingStreak - 1 : -1;
	}
};
