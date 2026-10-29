import random
import hashlib
import time
from typing import List, Dict

class Validator:
    def __init__(self, address: str, stake: float):
        self.address = address
        self.stake = stake
        self.blocks_validated = 0
        self.reputation = 1.0  # Reputation multiplier (can be used for selection logic)

    def __repr__(self):
        return f"Validator(address={self.address}, stake={self.stake}, blocks={self.blocks_validated})"

class ProofOfStake:
    def __init__(self):
        self.validators: Dict[str, Validator] = {}
        self.blockchain: List[Dict] = []
        self.pending_transactions: List[str] = []
        
        # Initial Genesis Block
        self.create_block(validator_address="Genesis", previous_hash="0")

    def add_validator(self, address: str, stake: float):
        """Register a new validator with an initial stake."""
        if address in self.validators:
            self.validators[address].stake += stake
        else:
            self.validators[address] = Validator(address, stake)
        print(f"[System] Validator {address} added/updated with stake {stake}.")

    def select_validator(self) -> Validator:
        """
        Validator selection logic:
        Probability of selection P(i) = Stake(i) / Total Stake
        Uses weighted random selection.
        """
        if not self.validators:
            return None
            
        validator_list = list(self.validators.values())
        stakes = [v.stake for v in validator_list]
        total_stake = sum(stakes)
        
        if total_stake == 0:
            return random.choice(validator_list)
            
        # Cumulative weights for selection
        selected_validator = random.choices(validator_list, weights=stakes, k=1)[0]
        return selected_validator

    def create_block(self, validator_address: str, previous_hash: str) -> Dict:
        """Simulate creating a new block in the chain."""
        block = {
            'index': len(self.blockchain) + 1,
            'timestamp': time.time(),
            'transactions': self.pending_transactions,
            'validator': validator_address,
            'previous_hash': previous_hash,
        }
        
        # Simple hashing for the block
        block_content = str(block).encode()
        block['hash'] = hashlib.sha256(block_content).hexdigest()
        
        self.blockchain.append(block)
        self.pending_transactions = [] # Reset pending transactions
        return block

    def run_validation_round(self):
        """Execute a round of PoS: Select validator, mint block, reward."""
        selected = self.select_validator()
        if not selected:
            print("[Error] No validators available to select.")
            return

        print(f"\n--- Round {len(self.blockchain)} ---")
        print(f"[Selection] Validator '{selected.address}' selected (Stake: {selected.stake})")
        
        previous_hash = self.blockchain[-1]['hash']
        new_block = self.create_block(selected.address, previous_hash)
        
        # Update validator stats
        selected.blocks_validated += 1
        
        # Reward the validator (Block Reward + Tip simulation)
        reward = 10.0 # Standard reward
        selected.stake += reward
        
        print(f"[Success] Block {new_block['index']} minted by {selected.address}")
        print(f"[Reward] {selected.address} received {reward} units. New Stake: {selected.stake}")

# --- Demonstration Script ---
if __name__ == "__main__":
    pos_system = ProofOfStake()
    
    # Adding some mock validators with different stakes
    pos_system.add_validator("Alice", 500)
    pos_system.add_validator("Bob", 200)
    pos_system.add_validator("Charlie", 50)
    pos_system.add_validator("David", 1000)

    # Adding some mock transactions
    pos_system.pending_transactions = ["Alice -> Bob: 10", "Charlie -> David: 5"]

    # Run 5 validation rounds to see the selection logic in action
    for i in range(5):
        pos_system.run_validation_round()
        time.sleep(0.5) # Simulate time gap

    print("\n--- Final Validator Status ---")
    for v in pos_system.validators.values():
        print(v)
