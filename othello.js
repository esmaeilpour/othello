var othello = {};

(function () {
  'use strict';

  // Utilities {{{1

  function delay(expressionAsFunction) {
    var result;
    var isEvaluated = false;

    return function() {
      if (!isEvaluated) {
        result = expressionAsFunction();
        isEvaluated = true;
      }
      return result;
    };
  }

  function force(promise) {
    return promise();
  }

  function sum(ns) {
    return ns.reduce(function(t, n) {
      return t + n;
    });
  }

  function random(n) {
    return Math.floor(Math.random() * n);
  }

  // Core logic {{{1

  var N = 8;

  var EMPTY = 'empty';
  var WHITE = 'white';
  var BLACK = 'black';

  function ix(x, y) {
    return x + y * N;
  }

  function makeInitialGameBoard() {
    var board = [];

    for (var x = 0; x < N; x++)
      for (var y = 0; y < N; y++)
        board[ix(x, y)] = EMPTY;

    var x2 = N >> 1;
    var y2 = N >> 1;
    board[ix(x2 - 1, y2 - 1)] = WHITE;
    board[ix(x2 - 1, y2 - 0)] = BLACK;
    board[ix(x2 - 0, y2 - 1)] = BLACK;
    board[ix(x2 - 0, y2 - 0)] = WHITE;

    return board;
  }

  function makeInitialGameTree() {
    return makeGameTree(makeInitialGameBoard(), BLACK, false, 1);
  }

  function makeGameTree(board, player, wasPassed, nest) {
    return {
      board: board,
      player: player,
      moves: listPossibleMoves(board, player, wasPassed, nest)
    };
  }

  var moveGameTreePromise = {
    passing: function(gameTree, move) {
      return makeGameTree(gameTree.board, nextPlayer(gameTree.player), true, move.nest + 1);
    },
    attacking: function(gameTree, move) {
      var vulnerableCells = listVulnerableCells(gameTree.board, move.x, move.y, gameTree.player);
      return makeGameTree(
        makeAttackedBoard(gameTree.board, move.x, move.y, vulnerableCells, gameTree.player),
        nextPlayer(gameTree.player),
        false,
        move.nest + 1
      );
    },
    depth: function(gameTree, move) {
      return limitGameTreeDepth(moveGameTreePromise[move.orginalGameTreePromiseName](gameTree, move), move.depth - 1);
    }
  }

  function listPossibleMoves(board, player, wasPassed, nest) {
    return completePassingMove(
      listAttackingMoves(board, player, nest),
      board,
      player,
      wasPassed,
      nest
    );
  }

  function completePassingMove(attackingMoves, board, player, wasPassed, nest) {
    if (0 < attackingMoves.length)
      return attackingMoves;
    else if (!wasPassed)
      return [{
        isPassingMove: true,
        gameTreePromiseName: 'passing'
      }];
    else
      return [];
  }

  // function listAttackingMovesN(board, player, nest) {
  //   var moves = [];
  //
  //   for (var y = 0; y < N; y++) {
  //     for (var x = 0; x < N; x++) {
  //       var vulnerableCells = listVulnerableCells(board, x, y, player);
  //       if (canAttack(vulnerableCells)) {
  //         moves.push({
  //           x: x,
  //           y: y,
  //           gameTreePromise: (function(x, y, vulnerableCells) {
  //             return delay(function() {
  //               return makeGameTree(
  //                 makeAttackedBoard(board, x, y, vulnerableCells, player),
  //                 nextPlayer(player),
  //                 false,
  //                 nest + 1
  //               );
  //             });
  //           })(x, y, vulnerableCells)
  //         });
  //       }
  //     }
  //   }
  //
  //   return moves;
  // }

  function listAttackingMoves8(board, player, nest) {
    var cells = []
    listAttackableCells(board, player).forEach(function(c) {
      var x = c & 0x07;
      var y = c >> 3;
      cells.push({
        x: x,
        y: y,
        gameTreePromiseName: 'attacking'
      })
    });
    return cells
  }

  var listAttackingMoves = N === 8 ? listAttackingMoves8 : listAttackingMovesN;

  function nextPlayer(player) {
    return player === BLACK ? WHITE : BLACK;
  }

  function canAttack(vulnerableCells) {
    return vulnerableCells.length;
  }

  function makeAttackedBoard(board, x, y, vulnerableCells, player) {
    var newBoard = board.slice();
    newBoard[ix(x, y)] = player;
    for (var i = 0; i < vulnerableCells.length; i++)
      newBoard[vulnerableCells[i]] = player;
    return newBoard;
  }

  function listVulnerableCells(board, x, y, player) {
    var vulnerableCells = [];

    if (board[ix(x, y)] !== EMPTY)
      return vulnerableCells;

    var opponent = nextPlayer(player);
    for (var dx = -1; dx <= 1; dx++) {
      for (var dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0)
          continue;
        for (var i = 1; i < N; i++) {
          var nx = x + i * dx;
          var ny = y + i * dy;
          if (nx < 0 || N <= nx || ny < 0 || N <= ny)
            break;
          var cell = board[ix(nx, ny)];
          if (cell === player && 2 <= i) {
            for (var j = 1; j < i; j++)
              vulnerableCells.push(ix(x + j * dx, y + j * dy));
            break;
          }
          if (cell !== opponent)
            break;
        }
      }
    }

    return vulnerableCells;
  }

  function judge(board) {
    var n = boardStat(board)
    if (n[BLACK] > n[WHITE])
      return 1;
    if (n[BLACK] < n[WHITE])
      return -1;
    return 0;
  }

  function boardStat(board) {
    var n = {};
    n[BLACK] = 0;
    n[WHITE] = 0;
    n[EMPTY] = 0;
    for (var i = 0; i < board.length; i++)
      n[board[i]]++;
    return n
  }

  function nameMove(move) {
    if (move.isPassingMove)
      return 'Pass';
    else
      return 'abcdefgh' [move.x] + '12345678' [move.y];
  }




  // Core logic: Bit board  {{{1
  //
  // Naming conventions:
  //   b = black
  //   w = white
  //   o = offense
  //   d = defense
  //   e = empty
  //   a = attackable
  //   u = upper half of a board
  //   l = lower half of a board
  //
  // Assumption: N = 8

  var N2 = N >> 1;

  function listAttackableCells(board, player) {
    var bb = makeBitBoard(board);
    var ou = player === BLACK ? bb.blackUpper : bb.whiteUpper;
    var ol = player === BLACK ? bb.blackLower : bb.whiteLower;
    var du = player === BLACK ? bb.whiteUpper : bb.blackUpper;
    var dl = player === BLACK ? bb.whiteLower : bb.blackLower;
    var eu = ~(ou | du);
    var el = ~(ol | dl);
    var au = 0;
    var al = 0;
    var at;

    at = listAttackableBitsAtUp(ou, ol, du, dl, eu, el);
    au |= at.upper;
    al |= at.lower;

    at = listAttackableBitsAtRightUp(ou, ol, du, dl, eu, el);
    au |= at.upper;
    al |= at.lower;

    au |= listAttackableBitsAtRight(ou, du, eu);
    al |= listAttackableBitsAtRight(ol, dl, el);

    at = listAttackableBitsAtRightDown(ou, ol, du, dl, eu, el);
    au |= at.upper;
    al |= at.lower;

    at = listAttackableBitsAtDown(ou, ol, du, dl, eu, el);
    au |= at.upper;
    al |= at.lower;

    at = listAttackableBitsAtLeftDown(ou, ol, du, dl, eu, el);
    au |= at.upper;
    al |= at.lower;

    au |= listAttackableBitsAtLeft(ou, du, eu);
    al |= listAttackableBitsAtLeft(ol, dl, el);

    at = listAttackableBitsAtLeftUp(ou, ol, du, dl, eu, el);
    au |= at.upper;
    al |= at.lower;

    return cellPositionsFromBitBoard(au, al);
  }

  function makeBitBoard(board) {
    //                    MSB                   LSB
    //                     1a 1b 1c 1d 1e 1f 1g 1h MSB
    //                     2a 2b 2c 2d 2e 2f 2g 2h
    //             upper   3a 3b 3c 3d 3e 3f 3g 3h
    //                     4a 4b 4c 4d 4e 4f 4g 4h
    // bit board =   +   =
    //                     5a 5b 5c 5d 5e 5f 5g 5h
    //             lower   6a 6b 6c 6d 6e 6f 6g 6h
    //                     7a 7b 7c 7d 7e 7f 7g 7h
    //                     8a 8b 8c 8d 8e 8f 8g 8h LSB
    var bu = 0;
    var bl = 0;
    var wu = 0;
    var wl = 0;
    var nu = N2 - 1;
    var nl = N - 1;
    var n = N - 1;
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        if (y < N2) {
          var i = ix(x, y);
          bu |= (board[i] === BLACK ? 1 : 0) << (n - x) << ((nu - y) * N);
          wu |= (board[i] === WHITE ? 1 : 0) << (n - x) << ((nu - y) * N);
        } else {
          var j = ix(x, y);
          bl |= (board[j] === BLACK ? 1 : 0) << (n - x) << ((nl - y) * N);
          wl |= (board[j] === WHITE ? 1 : 0) << (n - x) << ((nl - y) * N);
        }
      }
    }
    return {
      blackUpper: bu,
      blackLower: bl,
      whiteUpper: wu,
      whiteLower: wl
    };
  }

  function cellPositionsFromBitBoard(au, al) {
    var positions = [];

    for (var yu = 0; yu < N2 && au; yu++) {
      for (var xu = 0; xu < N && au; xu++) {
        if (au & 0x80000000)
          positions.push(ix(xu, yu));
        au <<= 1;
      }
    }

    for (var yl = N2; yl < N && al; yl++) {
      for (var xl = 0; xl < N && al; xl++) {
        if (al & 0x80000000)
          positions.push(ix(xl, yl));
        al <<= 1;
      }
    }

    return positions;
  }

  function shiftUp(u, l) {
    return (u << N) |
      (l >>> (N * (N2 - 1)));
  }

  function shiftDown(u, l) {
    return (l >>> N) |
      ((u & 0x000000ff) << (N * (N2 - 1)));
  }

  function listAttackableBitsAtUp(ou, ol, _du, _dl, eu, el) {
    var du = _du & 0x00ffffff;
    var dl = _dl & 0xffffff00;
    var tu = du & shiftUp(ou, ol);
    var tl = dl & shiftUp(ol, 0);
    tu |= du & shiftUp(tu, tl);
    tl |= dl & shiftUp(tl, 0);
    tu |= du & shiftUp(tu, tl);
    tl |= dl & shiftUp(tl, 0);
    tu |= du & shiftUp(tu, tl);
    tl |= dl & shiftUp(tl, 0);
    tu |= du & shiftUp(tu, tl);
    tl |= dl & shiftUp(tl, 0);
    tu |= du & shiftUp(tu, tl);
    tl |= dl & shiftUp(tl, 0);
    return {
      upper: eu & shiftUp(tu, tl),
      lower: el & shiftUp(tl, 0)
    };
  }

  function listAttackableBitsAtRightUp(ou, ol, _du, _dl, eu, el) {
    var du = _du & 0x007e7e7e;
    var dl = _dl & 0x7e7e7e00;
    var tu = du & (shiftUp(ou, ol) >>> 1);
    var tl = dl & (shiftUp(ol, 0) >>> 1);
    tu |= du & (shiftUp(tu, tl) >>> 1);
    tl |= dl & (shiftUp(tl, 0) >>> 1);
    tu |= du & (shiftUp(tu, tl) >>> 1);
    tl |= dl & (shiftUp(tl, 0) >>> 1);
    tu |= du & (shiftUp(tu, tl) >>> 1);
    tl |= dl & (shiftUp(tl, 0) >>> 1);
    tu |= du & (shiftUp(tu, tl) >>> 1);
    tl |= dl & (shiftUp(tl, 0) >>> 1);
    tu |= du & (shiftUp(tu, tl) >>> 1);
    tl |= dl & (shiftUp(tl, 0) >>> 1);
    return {
      upper: eu & (shiftUp(tu, tl) >>> 1),
      lower: el & (shiftUp(tl, 0) >>> 1)
    };
  }

  function listAttackableBitsAtRight(o, _d, e) {
    var d = _d & 0x7e7e7e7e;
    var t = d & (o >>> 1);
    t |= d & (t >>> 1);
    t |= d & (t >>> 1);
    t |= d & (t >>> 1);
    t |= d & (t >>> 1);
    t |= d & (t >>> 1);
    return e & (t >>> 1);
  }

  function listAttackableBitsAtRightDown(ou, ol, _du, _dl, eu, el) {
    var du = _du & 0x007e7e7e;
    var dl = _dl & 0x7e7e7e00;
    var tl = dl & (shiftDown(ou, ol) >>> 1);
    var tu = du & (shiftDown(0, ou) >>> 1);
    tl |= dl & (shiftDown(tu, tl) >>> 1);
    tu |= du & (shiftDown(0, tu) >>> 1);
    tl |= dl & (shiftDown(tu, tl) >>> 1);
    tu |= du & (shiftDown(0, tu) >>> 1);
    tl |= dl & (shiftDown(tu, tl) >>> 1);
    tu |= du & (shiftDown(0, tu) >>> 1);
    tl |= dl & (shiftDown(tu, tl) >>> 1);
    tu |= du & (shiftDown(0, tu) >>> 1);
    tl |= dl & (shiftDown(tu, tl) >>> 1);
    tu |= du & (shiftDown(0, tu) >>> 1);
    return {
      upper: eu & (shiftDown(0, tu) >>> 1),
      lower: el & (shiftDown(tu, tl) >>> 1)
    };
  }

  function listAttackableBitsAtDown(ou, ol, _du, _dl, eu, el) {
    var du = _du & 0x00ffffff;
    var dl = _dl & 0xffffff00;
    var tl = dl & shiftDown(ou, ol);
    var tu = du & shiftDown(0, ou);
    tl |= dl & shiftDown(tu, tl);
    tu |= du & shiftDown(0, tu);
    tl |= dl & shiftDown(tu, tl);
    tu |= du & shiftDown(0, tu);
    tl |= dl & shiftDown(tu, tl);
    tu |= du & shiftDown(0, tu);
    tl |= dl & shiftDown(tu, tl);
    tu |= du & shiftDown(0, tu);
    tl |= dl & shiftDown(tu, tl);
    tu |= du & shiftDown(0, tu);
    return {
      upper: eu & shiftDown(0, tu),
      lower: el & shiftDown(tu, tl)
    };
  }

  function listAttackableBitsAtLeftDown(ou, ol, _du, _dl, eu, el) {
    var du = _du & 0x007e7e7e;
    var dl = _dl & 0x7e7e7e00;
    var tl = dl & (shiftDown(ou, ol) << 1);
    var tu = du & (shiftDown(0, ou) << 1);
    tl |= dl & (shiftDown(tu, tl) << 1);
    tu |= du & (shiftDown(0, tu) << 1);
    tl |= dl & (shiftDown(tu, tl) << 1);
    tu |= du & (shiftDown(0, tu) << 1);
    tl |= dl & (shiftDown(tu, tl) << 1);
    tu |= du & (shiftDown(0, tu) << 1);
    tl |= dl & (shiftDown(tu, tl) << 1);
    tu |= du & (shiftDown(0, tu) << 1);
    tl |= dl & (shiftDown(tu, tl) << 1);
    tu |= du & (shiftDown(0, tu) << 1);
    return {
      upper: eu & (shiftDown(0, tu) << 1),
      lower: el & (shiftDown(tu, tl) << 1)
    };
  }

  function listAttackableBitsAtLeft(o, _d, e) {
    var d = _d & 0x7e7e7e7e;
    var t = d & (o << 1);
    t |= d & (t << 1);
    t |= d & (t << 1);
    t |= d & (t << 1);
    t |= d & (t << 1);
    t |= d & (t << 1);
    return e & (t << 1);
  }

  function listAttackableBitsAtLeftUp(ou, ol, _du, _dl, eu, el) {
    var du = _du & 0x007e7e7e;
    var dl = _dl & 0x7e7e7e00;
    var tu = du & (shiftUp(ou, ol) << 1);
    var tl = dl & (shiftUp(ol, 0) << 1);
    tu |= du & (shiftUp(tu, tl) << 1);
    tl |= dl & (shiftUp(tl, 0) << 1);
    tu |= du & (shiftUp(tu, tl) << 1);
    tl |= dl & (shiftUp(tl, 0) << 1);
    tu |= du & (shiftUp(tu, tl) << 1);
    tl |= dl & (shiftUp(tl, 0) << 1);
    tu |= du & (shiftUp(tu, tl) << 1);
    tl |= dl & (shiftUp(tl, 0) << 1);
    tu |= du & (shiftUp(tu, tl) << 1);
    tl |= dl & (shiftUp(tl, 0) << 1);
    return {
      upper: eu & (shiftUp(tu, tl) << 1),
      lower: el & (shiftUp(tl, 0) << 1)
    };
  }

  // AI {{{1

  function makeAI(playerType) {
      var tokens = playerType.split('-');
      var aiType = tokens[0];
      var level = parseInt(tokens[1]);
      var extras = tokens.slice(2);
      var scorePosition = scorePositions[aiType];
      if (scorePosition !== undefined) {
        return makeScoreBasedAI({
          level: level,
          scorePosition: scorePosition
        });
      }
  }




  // AI: Weight table based + alpha-beta pruning {{{1

  function makeScorePositionWith(weightTable) {
    var wt = weightTable;
    return function(gameTree, player) {
      var board = gameTree.board;
      var opponent = nextPlayer(player);
      var ct = {};
      ct[player] = 1;
      ct[opponent] = -1;
      ct[EMPTY] = 0;
      var s = 0;
      for (var i = 0; i < board.length; i++)
        s += ct[board[i]] * wt[i];
      return s;
    };
  }

  var scorePositions = {
    simpleCount: makeScorePositionWith((function() {
      var t = [];
      for (var x = 0; x < N; x++)
        for (var y = 0; y < N; y++)
          t[ix(x, y)] = 1;
      return t;
    })()),
    basic: makeScorePositionWith((function() {
      var t = [];
      for (var x = 0; x < N; x++)
        for (var y = 0; y < N; y++)
          t[ix(x, y)] =
          (x === 0 || x === N - 1 ? 10 : 1) *
          (y === 0 || y === N - 1 ? 10 : 1);
      return t;
    })()),
    better: makeScorePositionWith((function() {
      var t = [];
      for (var x = 0; x < N; x++)
        for (var y = 0; y < N; y++)
          t[ix(x, y)] =
          (x === 0 || x === N - 1 ? 10 : 1) *
          (y === 0 || y === N - 1 ? 10 : 1);
      t[ix(0, 1)] = t[ix(0, N - 2)] = t[ix(N - 1, 1)] = t[ix(N - 1, N - 2)] =
        t[ix(1, 0)] = t[ix(N - 2, 0)] = t[ix(1, N - 1)] = t[ix(N - 2, N - 1)] = 0;
      return t;
    })()),
    edgesAndCorners: makeScorePositionWith((function() {
      var t = [];
      for (var x = 0; x < N; x++)
        for (var y = 0; y < N; y++)
          t[ix(x, y)] = 0;
      for (var x = 2; x < N - 2; x++) {
        t[ix(x, 0)] = 10;
        t[ix(x, N - 1)] = 10;
      }
      for (var y = 2; y < N - 2; y++) {
        t[ix(0, y)] = 10;
        t[ix(N - 1, y)] = 10;
      }
      t[ix(0, 1)] = t[ix(1, 0)] = t[ix(1, 1)] =
        t[ix(N - 1, 1)] = t[ix(N - 2, 0)] = t[ix(N - 2, 1)] =
        t[ix(1, N - 1)] = t[ix(0, N - 2)] = t[ix(1, N - 2)] =
        t[ix(N - 2, N - 1)] = t[ix(N - 1, N - 2)] = t[ix(N - 2, N - 2)] = -1;

      t[ix(0, 0)] = t[ix(0, N - 1)] =
        t[ix(N - 1, 0)] = t[ix(N - 1, N - 1)] = 100;
      return t;
    })()),
    moveCount: function(gameTree, player) {
      return gameTree.actualMoveCount * (gameTree.player == player ? 1 : -1);
    },
    moveCountAndPositions: function(gameTree, player) {
      return scorePositions.moveCount(gameTree, player) +
        scorePositions.edgesAndCorners(gameTree, player);
    }
  };

  function makeScoreBasedAI(config) {
    return {
      findTheBestMove: function(gameTree) {
        var ratings = calculateMaxRatings(
          limitGameTreeWithFeasibleDepth(gameTree, config.level),
          gameTree.player,
          Number.MIN_VALUE,
          Number.MAX_VALUE,
          config.scorePosition
        );
        var maxRating = Math.max.apply(null, ratings);
        return gameTree.moves[ratings.indexOf(maxRating)];
      }
    };
  }

  function limitGameTreeWithFeasibleDepth(gameTree, maxBoards) {
    return limitGameTreeDepth(
      gameTree,
      estimateFeasibleDepth(gameTree, maxBoards)
    );
  }

  function estimateFeasibleDepth(gameTree, maxBoards) {
    var oldApproxBoards = 1;
    var newApproxBoards = 1;
    var depth = 0;
    while (newApproxBoards <= maxBoards && 1 <= gameTree.moves.length) {
      oldApproxBoards = newApproxBoards;
      newApproxBoards *= gameTree.moves.length;
      depth += 1;
      gameTree = moveGameTreePromise[gameTree.moves[0].gameTreePromiseName](gameTree, gameTree.moves[0]);
    }
    var oldDiff = oldApproxBoards - maxBoards;
    var newDiff = newApproxBoards - maxBoards;
    return Math.abs(newDiff) - Math.abs(oldDiff) <= 0 ? depth : depth - 1;
  }

  function limitGameTreeDepth(gameTree, depth) {
    var moves = []
    if (depth) {
      gameTree.moves.forEach(function(m) {
        moves.push({
          isPassingMove: m.isPassingMove,
          x: m.x,
          y: m.y,
          depth: depth,
          orginalGameTreePromiseName: m.gameTreePromiseName,
          gameTreePromiseName: 'depth'
        });
      })
    }
    return {
      board: gameTree.board,
      player: gameTree.player,
      moves: moves,
      actualMoveCount: gameTree.moves.length
    };
  }

  function ratePosition(gameTree, player, scorePosition) {
    if (1 <= gameTree.moves.length) {
      var choose = gameTree.player === player ? Math.max : Math.min;
      return choose.apply(null, calculateRatings(gameTree, player, scorePosition));
    } else {
      return scorePosition(gameTree, player);
    }
  }

  function calculateRatings(gameTree, player, scorePosition) {
    var result = []
    gameTree.moves.forEach(function(m) {
      result.push(ratePosition(moveGameTreePromise[m.gameTreePromiseName](gameTree, m), player, scorePosition))
    })
    return result
  }

  function ratePositionWithAlphaBetaPruning(gameTree, player, lowerLimit, upperLimit, scorePosition) {
    if (1 <= gameTree.moves.length) {
      var judge =
        gameTree.player === player ?
        Math.max :
        Math.min;
      var rate =
        gameTree.player === player ?
        calculateMaxRatings :
        calculateMinRatings;
      return judge.apply(null, rate(gameTree, player, lowerLimit, upperLimit, scorePosition));
    } else {
      return scorePosition(gameTree, player);
    }
  }

  function calculateMaxRatings(gameTree, player, lowerLimit, upperLimit, scorePosition) {
    var ratings = [];
    var newLowerLimit = lowerLimit;
    for (var i = 0; i < gameTree.moves.length; i++) {
      var r = ratePositionWithAlphaBetaPruning(
        moveGameTreePromise[gameTree.moves[i].gameTreePromiseName](gameTree, gameTree.moves[i]),
        player,
        newLowerLimit,
        upperLimit,
        scorePosition
      );
      ratings.push(r);
      if (upperLimit <= r)
        break;
      newLowerLimit = Math.max(r, newLowerLimit);
    }
    return ratings;
  }

  function calculateMinRatings(gameTree, player, lowerLimit, upperLimit, scorePosition) {
    var ratings = [];
    var newUpperLimit = upperLimit;
    for (var i = 0; i < gameTree.moves.length; i++) {
      var r = ratePositionWithAlphaBetaPruning(
        moveGameTreePromise[gameTree.moves[i].gameTreePromiseName](gameTree, gameTree.moves[i]),
        player,
        upperLimit,
        newUpperLimit,
        scorePosition
      );
      ratings.push(r);
      if (r <= lowerLimit)
        break;
      newUpperLimit = Math.min(r, newUpperLimit);
    }
    return ratings;
  }

  // Public API {{{1

  othello.force = force;
  othello.delay = delay;
  othello.EMPTY = EMPTY;
  othello.WHITE = WHITE;
  othello.BLACK = BLACK;
  othello.nextPlayer = nextPlayer;
  othello.N = N;
  othello.ix = ix;
  othello.makeInitialGameBoard = makeInitialGameBoard;
  othello.judge = judge;
  othello.boardStat = boardStat;
  othello.makeAI = makeAI;
  othello.makeInitialGameTree = makeInitialGameTree;
  othello.nameMove = nameMove;
  othello.play = (gameTree, move) => {
    return moveGameTreePromise[move.gameTreePromiseName](gameTree, move)
  }

  // }}}
})();
// }}}

module.exports = othello
