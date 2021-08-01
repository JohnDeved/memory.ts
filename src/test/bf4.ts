import { attachSync } from '..'
import { DataTypes } from '../modules/dbg/types'

attachSync('bf4.exe').then(bf4 => {
  if (!bf4.is64bit) {
    console.log('sorry, only 64 bit version of bf4 supported')
    return bf4.detach()
  }

  console.log('attached to', bf4.processName, 'pid', bf4.pid)
  console.log('======== created by undefined. ========')
  console.log('=========== @undefined_prop ===========')

  enum SpottingEnum {
    none,
    active,
    passive,
    radar,
    unspottable,
  }

  const baseAddr = bf4.baseAddress()

  function isValidAddress (address?: number) {
    return typeof address === 'number' && !isNaN(address) && address > baseAddr && address < 0x000F000000000000
  }

  class SoldierEntity {
    constructor (public address: number) {}

    get isSprinting () {
      const sprintingAddress = bf4.address(this.address, 0x5B0)
      return Boolean(bf4.read(DataTypes.byte, sprintingAddress))
    }

    get isOccluded () {
      const occludedAddress = bf4.address(this.address, 0x05B1)
      return Boolean(bf4.read(DataTypes.byte, occludedAddress))
    }

    get spotType () {
      const spotTypeAddress = bf4.address(this.address, 0x0BF0, 0x0050)
      if (!isValidAddress(spotTypeAddress)) return
      const typeNum = bf4.read(DataTypes.byte, spotTypeAddress)
      return SpottingEnum[typeNum] as keyof typeof SpottingEnum | undefined
    }

    set spotType (value: keyof typeof SpottingEnum | undefined) {
      const spotTypeAddress = bf4.address(this.address, 0x0BF0, 0x0050)
      if (!isValidAddress(spotTypeAddress)) return
      if (!value) return
      bf4.write(DataTypes.byte, spotTypeAddress, SpottingEnum[value])
    }
  }

  class Player {
    constructor (public address: number) {}

    get name () {
      const nameAddress = bf4.address(this.address, 0x40)
      return bf4.read(DataTypes.ascii, nameAddress)
    }

    get isSpectator () {
      const isSpectatorAddress = bf4.address(this.address, 0x13C9)
      return Boolean(bf4.read(DataTypes.byte, isSpectatorAddress))
    }

    get teamId () {
      const teamIdAddress = bf4.address(this.address, 0x13CC)
      return bf4.read(DataTypes.byte4, teamIdAddress)
    }

    get soldier () {
      const entityAddress = bf4.address(this.address, 0x14D0)
      if (!isValidAddress(entityAddress)) return
      return new SoldierEntity(entityAddress)
    }
  }

  class Game {
    readonly context = 0x142670d80

    get playerManager () {
      return bf4.address(this.context, 0x60)
    }

    get playerLocal () {
      const playerAddress = bf4.address(this.playerManager, 0x540)
      return new Player(playerAddress)
    }

    get players () {
      const playersAddress = bf4.address(this.playerManager, 0x548)

      const players: Player[] = []

      for (let i = 0; i < 64; i++) {
        const playerAddress = bf4.address(playersAddress, i * /* int64 size */ 0x8)
        const checkPointer = bf4.address(playerAddress, 0x0)

        if (isValidAddress(checkPointer)) {
          players.push(new Player(playerAddress))
        }
      }

      return players
    }
  }

  const game = new Game()

  function doSpotting () {
    const localTeamId = game.playerLocal.teamId
    const players = game.players

    for (const player of players) {
      if (localTeamId === player.teamId) continue

      const soldier = player.soldier
      if (!soldier) continue

      const spotType = soldier.spotType
      if (!spotType || spotType === 'active') continue

      soldier.spotType = 'active'
      console.log(spotType.padEnd(11, ' '), '=> active [', player.name, ']')
    }

    doSpotting()
  }

  process.on('exit', function () {
    bf4.detach()
  })

  doSpotting()
})
