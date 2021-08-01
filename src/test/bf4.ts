import internal from 'stream'
import { attachSync } from '..'
import { DataTypes } from '../modules/dbg/types'

attachSync('bf4.exe').then(process => {
  console.log(process.is64bit, process.pid, process.processName)

  function isValid (address?: number) {
    return typeof address === 'number' && address > 0x10000 && address < 0x000F000000000000
  }

  enum SpottingEnum {
    none,
    active,
    passive,
    radar,
    unspottable,
  }

  class SoliderEntity {
    constructor (public address: number) {}

    get isSprinting () {
      const sprintingAddress = process.address(this.address, 0x5B0)
      return Boolean(process.read(DataTypes.byte, sprintingAddress))
    }

    get isOccluded () {
      const occludedAddress = process.address(this.address, 0x05B1)
      return Boolean(process.read(DataTypes.byte, occludedAddress))
    }

    get spotType () {
      const spotTypeAddress = process.address(this.address, 0x0BF0, 0x0050)
      const typeNum = process.read(DataTypes.byte, spotTypeAddress)
      return SpottingEnum[typeNum] as keyof typeof SpottingEnum
    }

    set spotType (value: keyof typeof SpottingEnum) {
      const spotTypeAddress = process.address(this.address, 0x0BF0, 0x0050)
      process.write(DataTypes.byte, spotTypeAddress, SpottingEnum[value])
    }
  }

  class Player {
    constructor (public address: number) {}

    get name () {
      const nameAddress = process.address(this.address, 0x40)
      return process.read(DataTypes.ascii, nameAddress)
    }

    get isSpectator () {
      const isSpectatorAddress = process.address(this.address, 0x13C9)
      return Boolean(process.read(DataTypes.byte, isSpectatorAddress))
    }

    get teamId () {
      const teamIdAddress = process.address(this.address, 0x13CC)
      return process.read(DataTypes.byte4, teamIdAddress)
    }

    get solider () {
      const entityAddress = process.address(this.address, 0x14D0)

      if (isValid(entityAddress)) {
        return new SoliderEntity(entityAddress)
      }
    }
  }

  class Game {
    readonly context = 0x142670d80

    get playerManager () {
      return process.address(this.context, 0x60)
    }

    get playerLocal () {
      const playerAddress = process.address(this.playerManager, 0x540)
      return new Player(playerAddress)
    }

    get players () {
      const playersAddress = process.address(this.playerManager, 0x548)

      const players: Player[] = []

      for (let i = 0; i < 64; i++) {
        const playerAddress = process.address(playersAddress, i * /* int64 size */ 0x8)
        const checkPointer = process.address(playerAddress, 0x0)

        if (checkPointer) {
          players.push(new Player(playerAddress))
        }
      }

      return players
    }
  }

  const game = new Game()

  setInterval(() => {
    game.players.forEach((player, i) => {
      if (player.solider?.spotType && player.solider.spotType !== 'active' && game.playerLocal.teamId !== player.teamId) {
        console.log('setting spot from', player.solider.spotType, 'to active for', player.name)
        player.solider.spotType = 'active'
      }
    })
  }, 1000)

  // process.detach()
})
