import { fetchGameById, updateGameFen, updateGameStatus } from '../db/games.js';
import { getLatestMove, addMove } from '../db/moves.js';
import { isBlocked } from './friends.js';
import { createNotification } from '../db/notifications.js';
import { validateMove, applyMove } from './chesslogic.js';
console.log('LEGACY makeMove module loaded');

// Determine whose turn it is based on move count
function getExpectedPlayerColor(moveCount) {
    return moveCount % 2 === 0 ? 'white' : 'black';
}

// Make a move with full validation + chess logic
export async function makeMovesLegacy({
    game_id,
    user_id,
    san,
    from_square,
    to_square
}) {
    const game = await fetchGameById(game_id);
    if (!game) throw new Error('Game not found');

    const { white_user_id, black_user_id, status } = game;

    // Game must be active
    if (status !== 'active') {
        throw new Error('Game is not active');
    }

    // Block enforcement
    if (await isBlocked(white_user_id, black_user_id)) {
        throw new Error('Cannot make moves — users are blocked');
    }

    // Determine move number
    const lastMove = await getLatestMove(game_id);
    const move_number = lastMove ? lastMove.move_number + 1 : 1;

    // Determine whose turn it is
    const expectedColor = getExpectedPlayerColor(move_number - 1);

    // Validate turn order
    if (expectedColor === 'white' && user_id !== white_user_id) {
        throw new Error('Not white’s turn');
    }
    if (expectedColor === 'black' && user_id !== black_user_id) {
        throw new Error('Not black’s turn');
    }

    // Validate move legality using chess.js
    const isLegal = await validateMove(game_id, san);
    if (!isLegal) {
        throw new Error('Illegal move');
    }

    // Apply move and get updated FEN + status
    const { fen, status: gameStatus } = await applyMove(game_id, san);

    // Record the move
    const moveId = await addMove({
        game_id,
        move_number,
        player_color: expectedColor,
        san,
        from_square,
        to_square
    });

    // Update game FEN
    await updateGameFen(game_id, fen);

    // If game ended, update status
    if (gameStatus.state !== 'active' && gameStatus.state !== 'check') {
        await updateGameStatus(game_id, gameStatus.state);

        // Notify both players
        await createNotification({
            user_id: white_user_id,
            type: 'game_completed',
            payload: { game_id, result: gameStatus }
        });

        await createNotification({
            user_id: black_user_id,
            type: 'game_completed',
            payload: { game_id, result: gameStatus }
        });

        return moveId;
    }

    // Notify opponent for normal move
    const opponent_id =
        expectedColor === 'white' ? black_user_id : white_user_id;

    await createNotification({
        user_id: opponent_id,
        type: 'move_made',
        payload: { game_id, move_number }
    });

    return moveId;
}
