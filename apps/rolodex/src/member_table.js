 export class MemberTable extends HTMLElement {
  gridSize = 'grid-cols-8';
  constructor() {
    super();

    this.options = JSON.parse(this.getAttribute("data-options")) || {};
    this.filters = {}
    this.filterOptions = {}
    // Initialize filters and filterOptions based on the provided options
    Object.keys(this.options).forEach(key => {
      this.filters[key] = [];
      this.filterOptions[key] = this.options[key].symbols;
    });
   
    const container = document.createElement('div');
    container.classList.add('relative');
   
    // Create a sticky header container
    const stickyHeader = document.createElement('div');
    stickyHeader.classList.add('sticky', 'top-0', 'bg-gray-200', 'z-10','table', 'table-lg', 'table-pin-rows' );
   
    // Create a table element
    const table = document.createElement('table');
    table.classList.add('table', 'table-lg', 'table-pin-rows');
    // Create the table header row
    const thead = table.createTHead();
    const headerRow = document.createElement('tr');
    headerRow.classList.add('grid', this.gridSize); 
    const headers = ['Name (sort)', ...Object.keys(this.options).map(key => this.options[key].label)];
    headers.forEach((headerText, index) => {
      const th = document.createElement('th');
      th.classList.add('cursor-pointer','col-span-2', 'relative') //add value for 'col-span-X'  based on corresponding row element size
      
      // Create header content
      const headerContent = document.createElement('div');
      headerContent.classList.add('flex', 'items-center', 'justify-between');
      headerContent.innerHTML = `
        <span>${headerText}</span>
        ${index > 0 ? `
          <button class="filter-button">
            <svg class="filter-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
          </button>
        ` : ''}
      `;
      th.appendChild(headerContent);

      th.value = "asc";
      th.onclick = (e) => {
        if (headerText === 'Name (sort)') {
          this.sortTableBasedOnName(th);
        }
        // Prevent filter dropdown from opening when clicking on the header for sorting
        e.stopPropagation();
      };
      
      // Create filter dropdown for columns other than 'Name'
      if (index > 0) {
        const filterDropdown = document.createElement('div');
        filterDropdown.classList.add('filter-dropdown', 'hidden', 'fixed', 'border', 'border-gray-300', 'shadow-lg', 'z-50', 'p-2','max-h-[80vh]', 'overflow-y-auto', 'bg-[#0f1729]');
        this.createFilterOptions(filterDropdown, Object.keys(this.options)[index - 1]);
        
        document.body.appendChild(filterDropdown);  // Append to body
        
        // Add click event for filter button
        const filterButton = th.querySelector('.filter-button');
        filterButton.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleFilterDropdown(filterDropdown, th);
        });
      }
      
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    stickyHeader.appendChild(thead);

    const tbody = table.createTBody();

    
    // Append the table to the Shadow DOM
    // Append the sticky header and table to the container
    container.appendChild(stickyHeader);
    container.appendChild(table);

    // Append the container to the Shadow DOM
    this.appendChild(container);

    const scrollableArea = document.createElement('div');
    scrollableArea.classList.add('max-h-[calc(100vh-200px)]', 'overflow-y-auto');
    scrollableArea.appendChild(tbody);
    table.appendChild(scrollableArea);
    this._members = [];

    // Initialize filters
   
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.filter-dropdown') && !e.target.closest('.filter-button')) {
        this.closeAllDropdowns();
      }
    });
   window.addEventListener('resize', () => this.handleWindowResize());
  }

  // New method to create filter options
  createFilterOptions(dropdown, column) {
    dropdown.setAttribute('data-header', this.options[column].label);
    // Convert column to lowercase for case-insensitive matching
    const lowercaseColumn = column.toLowerCase();
    
    if (!this.filterOptions) {
      console.error('Filter options are undefined in createFilterOptions');
      return;
    }
    // Find the matching key in filterOptions
    const matchingKey = Object.keys(this.filterOptions).find(key => key.toLowerCase() === lowercaseColumn);
    
    if (!matchingKey) {
      console.error(`No filter options found for column: ${column}`);
      return;
    }
    
    const options = this.filterOptions[matchingKey];
    options.forEach(option => {
      const label = document.createElement('label');
      label.classList.add('block', 'mb-1', 'flex', 'items-center','text-ellipsis','overflow-hidden'); // Added flex and items-center
      label.innerHTML = `
        <input type="checkbox" value="${option.toLowerCase()}" class="mr-2 form-checkbox ">
        <span>${option}</span>
      `;
      label.querySelector('input').addEventListener('change', (e) => {
        this.updateFilter(matchingKey, e.target.value, e.target.checked);
      });
      dropdown.appendChild(label);
    });
  }
  toggleFilterDropdown(dropdown, th) {
    dropdown.classList.toggle('hidden');
    
    if (!dropdown.classList.contains('hidden')) {
      const rect = th.getBoundingClientRect();
      dropdown.style.top = `${rect.bottom}px`;
      dropdown.style.left = `${rect.left}px`;
      dropdown.style.width = `${rect.width}px`;
    }
  }

  closeAllDropdowns() {
    document.querySelectorAll('.filter-dropdown').forEach(dropdown => {
      dropdown.classList.add('hidden');
    });
  }

  updateFilterButtonAppearance(column) {
    const spans = document.querySelectorAll('.flex.items-center.justify-between span');
    spans.forEach((span) => {
      const spanText = span.textContent.replace(/\s/g, '').toLowerCase();
      if (spanText === column.toLowerCase()) {
        const flexParent = span.closest('.flex');
        const filterIcon = flexParent.querySelector('.filter-icon');
        if (this.filters[column].length > 0) {
          filterIcon.setAttribute('fill', 'currentColor');
        }
        else {
          filterIcon.setAttribute('fill', 'none');
        }
      }
    });  
  }

  isTagHighlighted(column, tag) {
    return this.filters[column].includes(tag.toLowerCase());
  }

  updateFilter(column, value, checked) {
    if (checked) {
      this.filters[column].push(value);
    } else {
      this.filters[column] = this.filters[column].filter(v => v !== value);
    }
    this.updateFilterButtonAppearance(column);
    this.applyFilters();
  }

  handleWindowResize() {
    document.querySelectorAll('.filter-dropdown:not(.hidden)').forEach(dropdown => {
      const th = this.findAssociatedTh(dropdown);
      if (th) {
        this.toggleFilterDropdown(dropdown, th);
      }
    });
  }

  applyFilters() {
    if (!this.filters) {
      console.error('Filters are undefined in applyFilter');
      return;
    }
    const filteredMembers = this._members.filter(member => {
      return Object.entries(this.filters).every(([column, filters]) => {
        if (filters.length === 0) return true;
        const memberValues = Array.isArray(member[column]) ? member[column] : [member[column]];
        return filters.some(filter =>
          memberValues.some(value => value.toLowerCase().includes(filter.toLowerCase()))
        );
      });
    });

    this.updateTable(filteredMembers);
  }

  findAssociatedTh(dropdown) {
    const headerText = dropdown.getAttribute('data-header');
    const headers = ['Name (sort)', ...Object.keys(this.options).map(key => this.options[key].label)];
    return this.querySelector(`th:nth-child(${headers.indexOf(headerText) + 1})`);
  }
  
  set members(value) {
    this._members = value;
    this.applyFilters();
  }

  // Define a property getter for the "contacts" property
  get members() {
    return this._members;
  }

  // Method to update the table based on the contacts data
  updateTable(memberList) {
    
    const tbody = this.querySelector('tbody');
    // Clear existing rows
    tbody.innerHTML=''
    var rowCount = 0;

    // Create table rows for contacts
    for (let [key, value] of Object.entries(memberList)) {
      if (value.archived == true) {
        continue;
      }
      const row = tbody.insertRow();
      row.classList.add('grid',this.gridSize, 'gap-2', 'place-content-center', 'hover');
      const nameCell = row.insertCell(0);
      nameCell.classList.add('flex', 'flex-row', 'justify-between', 'w-full', 'items-center', 'col-span-2', 'font-medium');
      nameCell.innerHTML = `<div class="avatar"><div class="w-8 rounded-full"><img src="${value.pfpUrl}" onerror="this.onerror=null;this.src='https://i.imgur.com/tmGAd6X.jpg';"/></div></div> <span class="text-center">${value.name}</span> <a href="https://warpcast.com/${value.handle}" target="_blank"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M18.24.24H5.76A5.76 5.76 0 0 0 0 6v12a5.76 5.76 0 0 0 5.76 5.76h12.48A5.76 5.76 0 0 0 24 18V6A5.76 5.76 0 0 0 18.24.24m.816 17.166v.504a.49.49 0 0 1 .543.48v.568h-5.143v-.569A.49.49 0 0 1 15 17.91v-.504c0-.22.153-.402.358-.458l-.01-4.364c-.158-1.737-1.64-3.098-3.443-3.098c-1.804 0-3.285 1.361-3.443 3.098l-.01 4.358c.228.042.532.208.54.464v.504a.49.49 0 0 1 .543.48v.568H4.392v-.569a.49.49 0 0 1 .543-.479v-.504c0-.253.201-.454.454-.472V9.039h-.49l-.61-2.031H6.93V5.042h9.95v1.966h2.822l-.61 2.03h-.49v7.896c.252.017.453.22.453.472"/></svg></a>`;
      
      Object.keys(this.options).forEach(optionKey => {
        const cell = row.insertCell();
        cell.classList.add('col-span-2', 'font-medium', 'space-x-1');
        if (value[optionKey] !== undefined && value[optionKey].length > 0) {
          let tags = Array.isArray(value[optionKey]) ? value[optionKey] : [value[optionKey]];
          for (let tag of tags) {
            const badgeClass = this.isTagHighlighted(optionKey, tag) ? 'border-1 border-white' : '';
            cell.innerHTML += `<span class="badge badge-md badge-secondary ${badgeClass}">${tag}</span>`;
          }
        } else {
          cell.innerHTML = '';
        }
      });
      tbody.appendChild(row);
      rowCount = rowCount + 1;
    };

    document.getElementById('member-count').innerHTML = rowCount;
  }

  sortTableBasedOnName(element) {
    switch (element.value) {
      case "asc":
        var sortedMemberList =  this._members.sort((a, b) => {
          return (a.name).localeCompare(b.name);
        });
        this.updateTable(sortedMemberList);
        element.textContent = "Name  ▼";
        element.value = "desc";
        break;
      case "desc":
        var sortedMemberList =  this._members.sort((a, b) => {
          return (b.name).localeCompare(a.name);
        });
        this.updateTable(sortedMemberList);
        element.textContent = "Name  ▲";
        element.value = "asc";
        break;
    }
  }

  resetFilters() {
    // Reset all filters
    Object.keys(this.options).forEach(key => {
      this.filters[key] = [];
    });
  
    // Uncheck all checkboxes
    document.querySelectorAll('.filter-dropdown input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = false;
    });
    this.querySelectorAll('.filter-icon').forEach(icon => {
        icon.setAttribute('fill', 'none');
    });
  
    // Apply the reset filters
    this.applyFilters();
  }
}
