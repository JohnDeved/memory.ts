import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { attachSync } from '..'
import { DataTypes } from '../modules/dbg/types'

const spottingCachePath = resolve(__dirname, '..', '..', 'src', 'examples', 'cache', 'spottingCache.json')
const spottingCache: { [key: string]: string | undefined } = JSON.parse(readFileSync(spottingCachePath, 'utf8'))

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

  function isValidAddress (address?: number) {
    return typeof address === 'number' && !isNaN(address) && address > 0x10000 && address < 0x000F000000000000
  }

  class SoldierEntity {
    constructor (public address: number) {}

    get isSprinting () {
      const sprintingAddress = bf4.address(this.address, 0x5B0)
      return Boolean(bf4.read(DataTypes.byte, sprintingAddress))
    }

    get isOccluded () {
      const occludedAddress = bf4.address(this.address, 0x5B1)
      return Boolean(bf4.read(DataTypes.byte, occludedAddress))
    }

    get spotType () {
      const spotTypeAddress = bf4.address(this.address, 0xBF0, 0x50)
      if (!isValidAddress(spotTypeAddress)) return

      const typeNum = bf4.read(DataTypes.byte, spotTypeAddress)
      const type = SpottingEnum[typeNum] as keyof typeof SpottingEnum | undefined
      if (type) {
        return type
      }
    }

    set spotType (value: keyof typeof SpottingEnum | undefined) {
      if (!value) return
      const spotTypeAddress = bf4.address(this.address, 0xBF0, 0x50)

      if (!isValidAddress(spotTypeAddress)) return
      bf4.write(DataTypes.byte, spotTypeAddress, SpottingEnum[value])
    }
  }

  class VehicleEntity {
    constructor (public address: number) {}

    private findSpottingOffset (name: string) {
      for (let index = 0x510; index <= 0xD80; index += 0x8) {
        const spottingComponent = bf4.address(this.address, index, 0x0)
        if (!isValidAddress(spottingComponent)) continue

        const spottingComponentCode = bf4.read(DataTypes.dword, spottingComponent)
        if (!isValidAddress(spottingComponentCode)) continue

        if (spottingComponentCode === 0x141BB04F0) {
          const offsetHex = index.toString(16)
          console.log('offset for', name, 'found at', offsetHex)
          spottingCache[name] = `0x${offsetHex}`
          writeFileSync(spottingCachePath, JSON.stringify(spottingCache, Object.keys(spottingCache).sort(), 4))
          return offsetHex
        }
      }
    }

    private getSpottingOffsetCache () {
      const name = this.name
      if (!name) return
      let offset = spottingCache[name]
      if (!offset) offset = this.findSpottingOffset(name)
      return offset
    }

    get className () {
      const vehicleClassNameAddress = bf4.address(this.address, 0x30, 0xF0, 0x0)
      if (!isValidAddress(vehicleClassNameAddress)) return
      return bf4.read(DataTypes.ascii, vehicleClassNameAddress)
    }

    get name () {
      const nameAddress = bf4.address(this.address, 0x30, 0x130, 0x0)
      if (!isValidAddress(nameAddress)) return
      return bf4.read(DataTypes.ascii, nameAddress)
    }

    get spotType () {
      const offset = Number(this.getSpottingOffsetCache())
      if (!offset) return

      const spotTypeAddress = bf4.address(this.address, Number(offset), 0x50)
      if (!isValidAddress(spotTypeAddress)) return

      const typeNum = bf4.read(DataTypes.byte, spotTypeAddress)
      return SpottingEnum[typeNum] as keyof typeof SpottingEnum | undefined
    }

    set spotType (value: keyof typeof SpottingEnum | undefined) {
      if (!value) return

      const offset = Number(this.getSpottingOffsetCache())
      if (!offset) return

      const spotTypeAddress = bf4.address(this.address, offset, 0x50)

      if (!isValidAddress(spotTypeAddress)) return
      bf4.write(DataTypes.byte, spotTypeAddress, SpottingEnum[value])
    }
  }

  class Player {
    constructor (public address: number) {}

    get isInVehicle () {
      const vehicleClassNameAddress = bf4.address(this.address, 0x14D0, 0x30, 0xF0, 0x0)
      if (!isValidAddress(vehicleClassNameAddress)) return
      const vehicleClassName = bf4.read(DataTypes.ascii, vehicleClassNameAddress)
      return vehicleClassName?.startsWith('vehicles')
    }

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
      if (!this.isInVehicle) {
        const entityAddress = bf4.address(this.address, 0x14D0)
        if (!isValidAddress(entityAddress)) return
        return new SoldierEntity(entityAddress)
      }
    }

    get vehicle () {
      if (this.isInVehicle) {
        const entityAddress = bf4.address(this.address, 0x14D0)
        if (!isValidAddress(entityAddress)) return
        return new VehicleEntity(entityAddress)
      }
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

  function spotSoldier (player: Player, soldier: SoldierEntity) {
    const spotType = soldier.spotType
    if (!spotType || spotType === 'active') return

    soldier.spotType = 'active'
    console.log(spotType.padEnd(11, ' '), '=> active [', player.name, ']')
  }

  function spotVehicle (player: Player, vehicle: VehicleEntity) {
    const spotType = vehicle.spotType
    if (!spotType || spotType === 'active') return

    vehicle.spotType = 'active'
    console.log(spotType.padEnd(11, ' '), '=> active vehicle [', player.name, vehicle.className, ']')
  }

  process.on('exit', function () {
    bf4.detach()
  })

  while (true) {
    const localTeamId = game.playerLocal.teamId
    const players = game.players

    for (const player of players) {
      if (localTeamId === player.teamId) continue

      const soldier = player.soldier
      if (soldier) {
        spotSoldier(player, soldier)
        continue
      }

      const vehicle = player.vehicle
      if (vehicle) {
        spotVehicle(player, vehicle)
        continue
      }
    }
  }
})
