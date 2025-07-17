import { useState } from 'react';
import { ethers } from 'ethers';

// Import all your utility functions
import { listProperty } from '../utils/listProperty';
import { getFraction } from '../utils/getFraction';
import { depositDividends } from '../utils/depositDividends';
import { distributeDividends } from '../utils/distributeDividends';
import { withdrawDividends } from '../utils/withdrawDividends';
import { dividendsOwed } from '../utils/dividendsOwed';
import { balanceOf } from '../utils/balanceOf';

export default function TestPage() {
    const [connectedAddress, setConnectedAddress] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState({});
    const [inputs, setInputs] = useState({
        // listProperty inputs
        tokenURI: 'ipfs://your-metadata-hash',
        name: 'My Property Shares',
        symbol: 'MPS',
        totalFractions: '1000',
        // getFraction inputs
        propertyIdForFraction: '0',
        // depositDividends inputs
        propertyIdForDeposit: '0',
        depositAmount: '0.1',
        // distributeDividends inputs (operates on the fraction token directly)
        fractionTokenForDistribute: '',
        distributeAmount: '0.1',
        // withdrawDividends inputs
        fractionTokenForWithdraw: '',
        // dividendsOwed inputs
        fractionTokenForOwed: '',
        userForOwed: '',
        // balanceOf inputs
        fractionTokenForBalance: '',
        userForBalance: '',
    });

    const handleConnect = async () => {
        if (window.ethereum) {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                setConnectedAddress(accounts[0]);
                setInputs(prev => ({ ...prev, userForOwed: accounts[0], userForBalance: accounts[0] }));
            } catch (error) {
                console.error("Connection failed", error);
                setResults(prev => ({ ...prev, connect: `Error: ${error.message}` }));
            }
        } else {
            setResults(prev => ({ ...prev, connect: 'MetaMask not found!' }));
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setInputs(prev => ({ ...prev, [name]: value }));
    };

    const runTest = async (testName, testFn) => {
        setLoading(true);
        setResults(prev => ({ ...prev, [testName]: 'Running...' }));
        try {
            const result = await testFn();
            let displayResult;
            if (typeof result === 'object' && result.hash) {
                displayResult = `Success! Tx Hash: ${result.hash}`;
            } else if (typeof result === 'bigint') {
                displayResult = ethers.formatEther(result) + " ETH";
            }
             else {
                displayResult = JSON.stringify(result);
            }
            setResults(prev => ({ ...prev, [testName]: displayResult }));
        } catch (error) {
            console.error(`Test ${testName} failed`, error);
            setResults(prev => ({ ...prev, [testName]: `Error: ${error.message}` }));
        }
        setLoading(false);
    };

    const renderInput = (name, placeholder, type = 'text') => (
        <input
            type={type}
            name={name}
            value={inputs[name]}
            onChange={handleInputChange}
            placeholder={placeholder}
            className="border px-2 py-1 rounded w-full mb-2"
        />
    );

    const renderTestSection = (title, testName, testFn, inputFields) => (
        <div className="bg-white p-4 rounded-lg shadow mb-4">
            <h3 className="font-bold text-lg mb-2">{title}</h3>
            {inputFields}
            <button
                onClick={() => runTest(testName, testFn)}
                disabled={loading || !connectedAddress}
                className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
            >
                Run Test
            </button>
            {results[testName] && <pre className="bg-gray-100 p-2 mt-2 rounded overflow-x-auto">{results[testName]}</pre>}
        </div>
    );

    return (
        <div className="container mx-auto p-8 font-sans">
            <h1 className="text-3xl font-bold mb-6">Smart Contract Test Page</h1>

            <div className="mb-6">
                <button onClick={handleConnect} className="bg-green-500 text-white px-6 py-2 rounded">
                    {connectedAddress ? `Connected: ${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}` : 'Connect Wallet'}
                </button>
                {results.connect && <p className="text-red-500 mt-2">{results.connect}</p>}
            </div>

            {/* Test listProperty */}
            {renderTestSection('1. List a New Property', 'listProperty',
                () => listProperty(inputs.tokenURI, inputs.name, inputs.symbol, inputs.totalFractions),
                <>
                    {renderInput('tokenURI', 'Token URI (e.g., ipfs://...')}
                    {renderInput('name', 'Fraction Token Name')}
                    {renderInput('symbol', 'Fraction Token Symbol')}
                    {renderInput('totalFractions', 'Total Fractions', 'number')}
                </>
            )}

            {/* Test getFraction */}
            {renderTestSection('2. Get Fraction Token Address', 'getFraction',
                () => getFraction(inputs.propertyIdForFraction),
                renderInput('propertyIdForFraction', 'Property ID', 'number')
            )}

            {/* Test depositDividends */}
            {renderTestSection('3. Deposit Dividends to Property', 'depositDividends',
                () => depositDividends(inputs.propertyIdForDeposit, inputs.depositAmount),
                <>
                    {renderInput('propertyIdForDeposit', 'Property ID', 'number')}
                    {renderInput('depositAmount', 'ETH Amount to Deposit', 'text')}
                </>
            )}
            
            <hr className="my-6"/>
            <h2 className="text-2xl font-bold mb-4">FractionToken Contract Tests</h2>
            <p className="mb-4 text-sm text-gray-600">Note: For these tests, you first need to get a fraction token address from Test #2.</p>


            {/* Test distributeDividends */}
            {renderTestSection('4. Distribute Dividends (Alternative)', 'distributeDividends',
                () => distributeDividends(inputs.fractionTokenForDistribute, inputs.distributeAmount),
                 <>
                    {renderInput('fractionTokenForDistribute', 'Fraction Token Address')}
                    {renderInput('distributeAmount', 'ETH Amount to Distribute', 'text')}
                </>
            )}

            {/* Test withdrawDividends */}
            {renderTestSection('5. Withdraw My Dividends', 'withdrawDividends',
                () => withdrawDividends(inputs.fractionTokenForWithdraw),
                renderInput('fractionTokenForWithdraw', 'Fraction Token Address')
            )}

            {/* Test dividendsOwed */}
            {renderTestSection('6. Check Dividends Owed', 'dividendsOwed',
                () => dividendsOwed(inputs.fractionTokenForOwed, inputs.userForOwed),
                 <>
                    {renderInput('fractionTokenForOwed', 'Fraction Token Address')}
                    {renderInput('userForOwed', 'User Address')}
                </>
            )}

            {/* Test balanceOf */}
            {renderTestSection('7. Check Fraction Balance', 'balanceOf',
                () => balanceOf(inputs.fractionTokenForBalance, inputs.userForBalance),
                 <>
                    {renderInput('fractionTokenForBalance', 'Fraction Token Address')}
                    {renderInput('userForBalance', 'User Address')}
                </>
            )}
        </div>
    );
}
