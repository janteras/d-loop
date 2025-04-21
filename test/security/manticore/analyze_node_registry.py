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
                            "../../../contracts/governance/AINodeRegistry.sol")

def analyze_node_registry():
    print("Starting Manticore analysis of AINodeRegistry contract...")
    
    # Initialize Manticore
    m = ManticoreEVM()
    
    # Add accounts
    admin_account = m.create_account(balance=10**18)
    user_account = m.create_account(balance=10**18)
    attacker_account = m.create_account(balance=10**18)
    soulbound_nft = m.create_account(balance=10**18)
    governance_contract = m.create_account(balance=10**18)
    
    # Deploy the contract with constructor arguments
    print("Deploying AINodeRegistry contract...")
    contract_account = m.solidity_create_contract(
        CONTRACT_PATH,
        owner=admin_account,
        args=[admin_account, governance_contract, soulbound_nft],
        contract_name="AINodeRegistry"
    )
    
    print(f"AINodeRegistry contract deployed at {contract_account.address}")
    
    # Symbolic values for testing
    symbolic_node_address = m.make_symbolic_value()
    symbolic_metadata = m.make_symbolic_buffer(32)
    symbolic_amount = m.make_symbolic_value()
    
    # Test privilege escalation in node registration
    print("Testing privilege escalation in node registration...")
    m.transaction(
        caller=attacker_account,
        address=contract_account,
        data=m.make_function_call("registerNode", [symbolic_node_address, attacker_account, symbolic_metadata]),
        value=0
    )
    
    # Test for access control in admin functions
    print("Testing access control in admin functions...")
    m.transaction(
        caller=attacker_account,
        address=contract_account,
        data=m.make_function_call("updateNodeState", [symbolic_node_address, 1]),  # 1 = Active state
        value=0
    )
    
    # Test for integer overflow/underflow in reputation updates
    print("Testing for integer overflow/underflow in reputation updates...")
    m.transaction(
        caller=admin_account,
        address=contract_account,
        data=m.make_function_call("updateNodeReputation", [symbolic_node_address, symbolic_amount]),
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
    analyze_node_registry()
