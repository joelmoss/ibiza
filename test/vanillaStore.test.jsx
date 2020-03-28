import React, { useCallback } from 'react'
import { render, fireEvent } from '@testing-library/react'

import { createStore } from '../src/vanillaStore'

test('setting same state with same value multiple times, renders only once', () => {
  const renderSpy = jest.fn()
  const useIbiza = createStore({
    firstName: 'Joel'
  })

  const App = () => {
    const { state, mutate } = useIbiza()
    const setLastName = useCallback(() => {
      mutate(s => {
        s.lastName = 'Moss'
      })
    }, [])

    renderSpy()

    return (
      <>
        <h1>
          Hello {state.firstName} {state.lastName}
        </h1>
        <button onClick={setLastName}>Set last name</button>
      </>
    )
  }

  const { getByRole } = render(<App />)
  const header = getByRole('heading')

  expect(header).toHaveTextContent('Hello Joel')

  fireEvent.click(getByRole('button'))

  expect(header).toHaveTextContent('Hello Joel Moss')

  fireEvent.click(getByRole('button'))

  expect(renderSpy).toBeCalledTimes(2)
})

test('mutating unused state should not re-render', () => {
  const renderSpy = jest.fn()
  const useIbiza = createStore({
    firstName: 'Joel'
  })

  const App = () => {
    const { state, mutate } = useIbiza()
    const setLastName = useCallback(() => {
      mutate(s => {
        s.lastName = 'Moss'
      })
    }, [])

    renderSpy()

    return (
      <>
        <h1>Hello {state.firstName}</h1>
        <button onClick={setLastName}>Set last name</button>
      </>
    )
  }

  const { getByRole } = render(<App />)
  const header = getByRole('heading')

  expect(header).toHaveTextContent('Hello Joel')

  fireEvent.click(getByRole('button'))

  expect(renderSpy).toBeCalledTimes(1)
})

test('mutating with identical value should not re-render', () => {
  const renderSpy = jest.fn()
  const useIbiza = createStore({
    firstName: 'Joel'
  })

  const App = () => {
    const { state, mutate } = useIbiza()
    const setLastName = useCallback(() => {
      mutate(s => {
        s.firstName = 'Joel'
      })
    }, [])

    renderSpy()

    return (
      <>
        <h1>Hello {state.firstName}</h1>
        <button onClick={setLastName}>Set first name</button>
      </>
    )
  }

  const { getByRole } = render(<App />)
  const header = getByRole('heading')

  expect(header).toHaveTextContent('Hello Joel')

  fireEvent.click(getByRole('button'))

  expect(renderSpy).toBeCalledTimes(1)
})

test.skip('multiple components', () => {
  const renderAppSpy = jest.fn()
  const renderFirstNameSpy = jest.fn()
  const renderLastNameSpy = jest.fn()
  const useIbiza = createStore({
    firstName: 'Joel'
  })

  const FirstName = () => {
    // const { firstName } = useIbiza()
    renderFirstNameSpy()
    return <>Joel</>
  }
  const LastName = () => {
    const {
      state: { lastName }
    } = useIbiza()
    renderLastNameSpy()
    return <>{lastName}</>
  }
  const App = () => {
    const { mutate } = useIbiza()
    const setLastName = useCallback(() => {
      // mutate(s => {
      //   s.lastName = 'Moss'
      // })
    }, [mutate])

    renderAppSpy()

    return (
      <>
        <h1>
          Hello{' '}
          <>
            <FirstName /> <LastName />
          </>
        </h1>
        <button onClick={setLastName}>Set last name</button>
      </>
    )
  }

  const { getByRole } = render(<App />)
  const header = getByRole('heading')

  expect(header).toHaveTextContent('Hello Joel')

  fireEvent.click(getByRole('button'))

  // expect(header).toHaveTextContent('Hello Joel Moss')

  expect(renderAppSpy).toBeCalledTimes(2)
  expect(renderFirstNameSpy).toBeCalledTimes(1)
  expect(renderLastNameSpy).toBeCalledTimes(2)
})
