#!/usr/bin/env python3

from manticore.ethereum import ManticoreEVM, ABI
from manticore.core.smtlib import Operators, solver
from manticore.utils import config
import sys
import os

# Configure Manticore
config.get_group("manticore").timeout = 120
config.get_group("smt").timeout = 60
config.get_group("evm").oog = "complete"

# Path to the contract
CONTRACT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 
                            "../../../contracts/fees/Treasury.sol")

def analyze_treasury():
    print("Starting Manticore analysis of Treasury contract...")
    
    # Initialize Manticore
    m = ManticoreEVM()
    
    # Add accounts
    user_account = m.create_account(balance=10**18)
    attacker_account = m.create_account(balance=10**18)
    
    # Deploy the contract with constructor arguments
    print("Deploying Treasury contract...")
    contract_account = m.solidity_create_contract(
        CONTRACT_PATH,
        owner=user_account,
        args=[user_account],  # ProtocolDAO address
        contract_name="Treasury"
    )
    
    print(f"Treasury contract deployed at {contract_account.address}")
    
    # Symbolic transaction to test withdraw function
    symbolic_amount = m.make_symbolic_value()
    symbolic_token = m.make_symbolic_value()
    
    # Test access control: Only owner should be able to withdraw
    print("Testing access control for withdraw function...")
    m.transaction(
        caller=attacker_account,
        address=contract_account,
        data=m.make_function_call("withdraw", [symbolic_token, attacker_account, symbolic_amount]),
        value=0
    )
    
    # Test for reentrancy vulnerabilities
    print("Testing for reentrancy vulnerabilities...")
    m.transaction(
        caller=user_account,
        address=contract_account,
        data=m.make_function_call("deposit", [symbolic_token, symbolic_amount, m.make_symbolic_buffer(32)]),
        value=0
    )
    
    # Test for integer overflow/underflow
    print("Testing for integer overflow/underflow...")
    m.transaction(
        caller=user_account,
        address=contract_account,
        data=m.make_function_call("withdraw", [symbolic_token, user_account, symbolic_amount]),
        value=0
    )
    
    # Run the analysis
    print("Running Manticore analysis...")
    m.finalize()
    
    # Generate report
    print("Generating report...")
    for state in m.terminated_states:
        if state.is_error():
            print(f"Found error: {state.context['last_exception']}")
            print(f"Transaction trace: {state.context['tx_trace']}")
    
    print("Analysis complete.")

if __name__ == "__main__":
    analyze_treasury()
