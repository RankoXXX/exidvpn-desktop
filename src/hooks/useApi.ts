import { useCallback } from 'react'
import type { Country, City, Server, Credentials, Device, IPInfo } from '../types/api'

export function useApi() {
  const checkDevice = useCallback(async (): Promise<boolean> => {
    return window.electron.checkDevice()
  }, [])

  const openPaymentPage = useCallback(async (): Promise<void> => {
    const paymentUrl = await window.electron.getPaymentUrl()
    await window.electron.openExternal(paymentUrl)
  }, [])

  const getDevice = useCallback(async (): Promise<Device> => {
    return window.electron.getDevice()
  }, [])

  const getCountries = useCallback(async (): Promise<Country[]> => {
    return window.electron.getCountries()
  }, [])

  const getCities = useCallback(async (countryId: string): Promise<City[]> => {
    return window.electron.getCities(countryId)
  }, [])

  const getCityServers = useCallback(async (cityId: string): Promise<Server[]> => {
    return window.electron.getCityServers(cityId)
  }, [])

  const createServerCredentials = useCallback(async (serverId: string): Promise<Credentials> => {
    return window.electron.createServerCredentials(serverId)
  }, [])

  const getIP = useCallback(async (): Promise<IPInfo> => {
    return window.electron.getIP()
  }, [])

  return {
    checkDevice,
    openPaymentPage,
    getDevice,
    getCountries,
    getCities,
    getCityServers,
    createServerCredentials,
    getIP
  }
}
