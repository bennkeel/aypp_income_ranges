function readCSV(onSuccess, onFailure) {
    // Default to B2 if no building specified
    const filePath = '../exports/units_ranges_long_B2.csv';
    
    fetch(filePath)
    .then(resp => {
        if (resp.status === 200){
            return resp.text();
        } else {
            alert('Failure to Load Data');
            if (onFailure) {onFailure();}
        }
    })
    .then(text => {
        const data = d3.csvParse(text);
        return data;
    })
    .then(onSuccess)
    .catch(error => {
        console.error("Error loading data:", error);
        alert(`Error loading data: ${error.message}`);
    });
}

export {
    readCSV,
};